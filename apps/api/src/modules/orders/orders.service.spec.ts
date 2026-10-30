/// <reference types="jest" />

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { JobsService } from '../jobs/jobs.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;
  let realtimeGateway: { emitNewOrder: jest.Mock; emitOrderStatusChanged: jest.Mock };

  let jobsService: { scheduleDailyStoreReport: jest.Mock; queueOrderNotification: jest.Mock };

  beforeEach(async () => {
    prisma = {
      cartItem: { findMany: jest.fn(), deleteMany: jest.fn() },
      store: { findUnique: jest.fn() },
      storeMember: { findUnique: jest.fn() },
      driver: { findUnique: jest.fn(), update: jest.fn() },
      order: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };
    realtimeGateway = {
      emitNewOrder: jest.fn(),
      emitOrderStatusChanged: jest.fn(),
    };
    jobsService = { scheduleDailyStoreReport: jest.fn(), queueOrderNotification: jest.fn(), } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeGateway, useValue: realtimeGateway },
        { provide: JobsService, useValue: jobsService },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create (checkout)', () => {
    const baseStore = {
      id: 'store-1',
      isDeleted: false,
      isOpen: true,
      minimumOrder: 50,
      deliveryFee: 15,
      settings: { commissionPercentage: 10 },
      // A store that never configured a weekly schedule: only the manual
      // isOpen toggle gates checkout (see isStoreOpenNow).
      workingHours: [],
    };

    it('rejects checkout when the cart has no items for this store', async () => {
      prisma.cartItem.findMany.mockResolvedValue([]);

      await expect(
        service.create('user-1', {
          storeId: 'store-1',
          customerName: 'Test',
          phone: '0100000000',
          fullAddress: 'Somewhere',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects checkout when the store is closed', async () => {
      prisma.cartItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 2, product: { storeId: 'store-1', price: 100, name: 'Item' } },
      ]);
      prisma.store.findUnique.mockResolvedValue({ ...baseStore, isOpen: false });

      await expect(
        service.create('user-1', {
          storeId: 'store-1',
          customerName: 'Test',
          phone: '0100000000',
          fullAddress: 'Somewhere',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects checkout below the minimum order value', async () => {
      prisma.cartItem.findMany.mockResolvedValue([
        { productId: 'p1', quantity: 1, product: { storeId: 'store-1', price: 20, name: 'Item' } },
      ]);
      prisma.store.findUnique.mockResolvedValue(baseStore);

      await expect(
        service.create('user-1', {
          storeId: 'store-1',
          customerName: 'Test',
          phone: '0100000000',
          fullAddress: 'Somewhere',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('computes subtotal, commission, and total correctly on a valid checkout', async () => {
      prisma.cartItem.findMany.mockResolvedValue([
        { id: 'ci1', productId: 'p1', quantity: 2, note: null, product: { storeId: 'store-1', price: 100, name: 'Item', image: null } },
      ]);
      prisma.store.findUnique.mockResolvedValue(baseStore);
      prisma.order.create.mockResolvedValue({ id: 'order-1', storeId: 'store-1' });
      prisma.cartItem.deleteMany.mockResolvedValue({});

      await service.create('user-1', {
        storeId: 'store-1',
        customerName: 'Test',
        phone: '0100000000',
        fullAddress: 'Somewhere',
      });

      const createArgs = prisma.order.create.mock.calls[0][0].data;
      expect(createArgs.subtotal).toBe(200); // 100 * 2
      expect(createArgs.commission).toBe(20); // 10% of 200
      expect(createArgs.total).toBe(215); // subtotal + deliveryFee
      expect(realtimeGateway.emitNewOrder).toHaveBeenCalledWith('store-1', expect.anything());
    });

    it('includes offer-based cart lines in checkout, not just product lines', async () => {
      // Regression test: the storeItems filter used to check only
      // item.product?.storeId, which is always undefined for an
      // offer-based cart line (product is null there) — silently dropping
      // every offer from checkout even though totals/order-items were
      // computed correctly for it elsewhere in this method.
      prisma.cartItem.findMany.mockResolvedValue([
        {
          id: 'ci1',
          productId: null,
          offerId: 'offer-1',
          quantity: 1,
          note: null,
          product: null,
          offer: { storeId: 'store-1', newPrice: 80, oldPrice: 100, titleAr: 'عرض خاص', image: null },
        },
      ]);
      prisma.store.findUnique.mockResolvedValue(baseStore);
      prisma.order.create.mockResolvedValue({ id: 'order-1', storeId: 'store-1' });
      prisma.cartItem.deleteMany.mockResolvedValue({});

      await service.create('user-1', {
        storeId: 'store-1',
        customerName: 'Test',
        phone: '0100000000',
        fullAddress: 'Somewhere',
      });

      const createArgs = prisma.order.create.mock.calls[0][0].data;
      expect(createArgs.subtotal).toBe(80);
      expect(createArgs.items.create).toHaveLength(1);
      expect(createArgs.items.create[0].offerId).toBe('offer-1');
    });
  });

  describe('updateStatus (state machine)', () => {
    it('throws NotFoundException for a missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('missing', 'ACCEPTED', 'user-1', 'ADMIN')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects an invalid transition (e.g. PENDING straight to DELIVERING)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderStatus: 'PENDING',
        userId: 'user-1',
        storeId: 'store-1',
      });

      await expect(service.updateStatus('order-1', 'DELIVERING', 'user-1', 'ADMIN')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('allows a valid transition and emits realtime + notification side-effects', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderStatus: 'PENDING',
        userId: 'user-1',
        storeId: 'store-1',
      });
      prisma.order.update.mockResolvedValue({ id: 'order-1', orderStatus: 'ACCEPTED' });

      const result = await service.updateStatus('order-1', 'ACCEPTED', 'user-1', 'ADMIN');

      expect(result.orderStatus).toBe('ACCEPTED');
      expect(realtimeGateway.emitOrderStatusChanged).toHaveBeenCalledWith(
        'order-1',
        'user-1',
        'store-1',
        'ACCEPTED',
      );
      expect(jobsService.queueOrderNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'ORDER_STATUS' }),
      );
    });

    it('schedules a daily report job when an order completes', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderStatus: 'DELIVERING',
        userId: 'user-1',
        storeId: 'store-1',
      });
      prisma.order.update.mockResolvedValue({ id: 'order-1', orderStatus: 'COMPLETED' });

      await service.updateStatus('order-1', 'COMPLETED', 'user-1', 'ADMIN');

      expect(jobsService.scheduleDailyStoreReport).toHaveBeenCalledWith('store-1');
    });
  });

  describe('updateStatus (object-level authorization)', () => {
    it('rejects a STORE_OWNER who does not own the order\'s store', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderStatus: 'PENDING',
        userId: 'customer-1',
        storeId: 'store-1',
        driverId: null,
      });
      prisma.store.findUnique.mockResolvedValue({ id: 'store-1', ownerId: 'someone-else' });
      prisma.storeMember.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('order-1', 'ACCEPTED', 'not-the-owner', 'STORE_OWNER'),
      ).rejects.toMatchObject({ status: 403 });
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('allows the STORE_OWNER who actually owns the order\'s store', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderStatus: 'PENDING',
        userId: 'customer-1',
        storeId: 'store-1',
        driverId: null,
      });
      prisma.store.findUnique.mockResolvedValue({ id: 'store-1', ownerId: 'real-owner' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', orderStatus: 'ACCEPTED' });

      const result = await service.updateStatus('order-1', 'ACCEPTED', 'real-owner', 'STORE_OWNER');
      expect(result.orderStatus).toBe('ACCEPTED');
    });

    it('rejects a DRIVER who is not the order\'s assigned driver', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderStatus: 'DELIVERING',
        userId: 'customer-1',
        storeId: 'store-1',
        driverId: 'driver-abc',
      });
      prisma.driver.findUnique.mockResolvedValue({ id: 'driver-xyz', userId: 'some-other-driver' });

      await expect(
        service.updateStatus('order-1', 'COMPLETED', 'some-other-driver', 'DRIVER'),
      ).rejects.toMatchObject({ status: 403 });
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('allows the DRIVER who is the order\'s assigned driver', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderStatus: 'DELIVERING',
        userId: 'customer-1',
        storeId: 'store-1',
        driverId: 'driver-abc',
      });
      prisma.driver.findUnique.mockResolvedValue({ id: 'driver-abc', userId: 'driver-user-1' });
      prisma.order.update.mockResolvedValue({ id: 'order-1', orderStatus: 'COMPLETED' });

      const result = await service.updateStatus('order-1', 'COMPLETED', 'driver-user-1', 'DRIVER');
      expect(result.orderStatus).toBe('COMPLETED');
    });
  });

  describe('findMyOrders', () => {
    beforeEach(() => {
      prisma.order.findMany = jest.fn();
    });

    it("only queries the caller's own orders, newest first", async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o1', userId: 'user-1' }]);

      const result = await service.findMyOrders('user-1');

      expect(result).toEqual([{ id: 'o1', userId: 'user-1' }]);
      const args = prisma.order.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ userId: 'user-1' });
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('returns an empty array (not null/undefined) for a user with no orders', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await expect(service.findMyOrders('new-user')).resolves.toEqual([]);
    });

    it('lets a database failure propagate so the global filter can map it (no swallowing)', async () => {
      prisma.order.findMany.mockRejectedValue(new Error('db down'));
      await expect(service.findMyOrders('user-1')).rejects.toThrow('db down');
    });
  });

  describe('findOne (order isolation)', () => {
    it("refuses another customer's order with 403 and never returns its data", async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'owner', storeId: 'store-1' });
      prisma.store.findUnique.mockResolvedValue({ id: 'store-1', ownerId: 'store-owner' });

      await expect(service.findOne('o1', 'intruder', 'USER')).rejects.toThrow('You cannot view this order');
    });

    it('lets the order owner read their own order', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'owner', storeId: 'store-1' });
      await expect(service.findOne('o1', 'owner', 'USER')).resolves.toMatchObject({ id: 'o1' });
    });
  });
});
