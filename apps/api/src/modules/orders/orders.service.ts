import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { JobsService } from '../jobs/jobs.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { isStoreOpenNow } from '../../common/utils/store-hours.util';

// Valid forward transitions for order lifecycle
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  ACCEPTED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.DELIVERING, OrderStatus.CANCELLED],
  DELIVERING: [OrderStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
    private jobsService: JobsService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    // Checkout runs as a single DB transaction: read cart -> validate -> compute totals -> persist -> clear cart
    return this.prisma.$transaction(async (tx) => {
      const cartItems = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true, offer: true },
      });

      // A cart line is either a product or an offer (never both) — filtering
      // on item.product?.storeId alone silently drops every offer-based
      // line from checkout (product is null there), even though the rest
      // of this method already computes totals and order items for offers
      // correctly. That's a live bug: any cart containing an offer would
      // checkout as if that item didn't exist.
      const storeItems = cartItems.filter(
        (item) => (item.product?.storeId ?? item.offer?.storeId) === dto.storeId,
      );

      if (storeItems.length === 0) {
        throw new BadRequestException('Cart is empty for this store');
      }

      const store = await tx.store.findUnique({
        where: { id: dto.storeId },
        include: { settings: true, workingHours: true },
      });
      if (!store || store.isDeleted) throw new NotFoundException('Store not found');
      // Blocks checkout both on the manual isOpen toggle and the configured
      // weekly schedule — a store with no schedule configured is only
      // gated by isOpen, unchanged from before this feature existed.
      if (!isStoreOpenNow(store.isOpen, store.workingHours)) {
        throw new BadRequestException('Store is currently closed');
      }

      const subtotal = storeItems.reduce((sum, item) => {
        const price = item.product?.price ?? item.offer?.newPrice ?? 0;
        return sum + Number(price) * item.quantity;
      }, 0);

      if (Number(store.minimumOrder) > subtotal) {
        throw new BadRequestException(
          `Minimum order value for this store is ${store.minimumOrder}`,
        );
      }

      const commissionPercentage = store.settings?.commissionPercentage ?? 10;
      const commission = (subtotal * Number(commissionPercentage)) / 100;
      const deliveryFee = Number(store.deliveryFee) || 0;
      const total = subtotal + deliveryFee;

      const order = await tx.order.create({
        data: {
          userId,
          storeId: dto.storeId,
          addressId: dto.addressId,
          customerName: dto.customerName,
          phone: dto.phone,
          fullAddress: dto.fullAddress,
          paymentMethod: dto.paymentMethod ?? 'CASH',
          subtotal,
          deliveryFee,
          commission,
          total,
          items: {
            create: storeItems.map((item) => ({
              productId: item.productId,
              offerId: item.offerId,
              productName: item.product?.name ?? 'Offer item',
              productImage: item.product?.image,
              quantity: item.quantity,
              price: item.product?.price ?? item.offer?.newPrice ?? 0,
              note: item.note,
            })),
          },
          statusHistory: {
            create: { status: 'PENDING' },
          },
        },
        include: { items: true },
      });

      await tx.cartItem.deleteMany({
        where: { id: { in: storeItems.map((item) => item.id) } },
      });

      return order;
    }).then(async (order) => {
      this.realtimeGateway.emitNewOrder(order.storeId, order);
      return order;
    });
  }

  async findMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true, store: true },
      orderBy: { createdAt: 'desc' },
      // A long-time customer's full order history was previously
      // unbounded — this returns the most recent 100, which covers
      // realistic "my orders" usage without changing the response shape
      // (still a flat array) or requiring any frontend change.
      take: 100,
    });
  }

  async findStoreOrders(storeId: string, userId: string, role: string) {
    await this.assertStoreAccess(storeId, userId, role);
    return this.prisma.order.findMany({
      where: { storeId },
      include: { items: true, user: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      // Same reasoning as findMyOrders — an established store's full order
      // history was unbounded before. The merchant dashboard shows recent
      // activity; older history stays available via reports/exports rather
      // than loading every row on every dashboard visit.
      take: 200,
    });
  }

  // A merchant's own EMPLOYEE/CASHIER staff (StoreMember rows) may also view
  // that store's orders — matches the @Roles(STORE_OWNER, EMPLOYEE, ...) list
  // already on the controller, which previously wasn't backed by any actual
  // per-store check here.
  private async assertStoreAccess(storeId: string, userId: string, role: string) {
    if (['ADMIN', 'SUPER_ADMIN'].includes(role)) return;
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    if (store.ownerId === userId) return;
    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!membership) throw new ForbiddenException('You do not have access to this store');
  }

  // updateStatus() previously trusted the controller's role list alone —
  // any STORE_OWNER/EMPLOYEE/DRIVER account could change the status of
  // *any* order, not just their own store's or their own delivery. This
  // checks the specific order against the caller's actual relationship to
  // it, same as assertStoreAccess above but also covering the DRIVER case
  // (must be the order's assigned driver, not just "a" driver).
  private async assertStatusChangeAccess(
    order: { storeId: string; driverId: string | null },
    userId: string,
    role: string,
  ) {
    if (['ADMIN', 'SUPER_ADMIN'].includes(role)) return;
    if (role === 'DRIVER') {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      if (!driver || order.driverId !== driver.id) {
        throw new ForbiddenException('You are not the assigned driver for this order');
      }
      return;
    }
    await this.assertStoreAccess(order.storeId, userId, role);
  }

  // Admin-wide order listing — separate from /orders/store/:id which is
  // scoped to one store.
  async findAllForAdmin(status?: string, search?: string) {
    return this.prisma.order.findMany({
      where: {
        ...(status ? { orderStatus: status as OrderStatus } : {}),
        ...(search
          ? {
              OR: [
                { user: { fullName: { contains: search, mode: 'insensitive' } } },
                { user: { phone: { contains: search, mode: 'insensitive' } } },
                { store: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        store: { select: { id: true, name: true } },
        user: { select: { fullName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, store: true, statusHistory: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    const isOwner = order.userId === userId;
    if (!isPrivileged && !isOwner) {
      const store = await this.prisma.store.findUnique({ where: { id: order.storeId } });
      if (store?.ownerId !== userId) {
        throw new ForbiddenException('You cannot view this order');
      }
    }
    return order;
  }

  async updateStatus(id: string, newStatus: OrderStatus, changedBy: string, role: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    await this.assertStatusChangeAccess(order, changedBy, role);

    const allowed = ALLOWED_TRANSITIONS[order.orderStatus];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.orderStatus} to ${newStatus}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        orderStatus: newStatus,
        statusHistory: { create: { status: newStatus, changedBy } },
      },
    });

    this.realtimeGateway.emitOrderStatusChanged(id, order.userId, order.storeId, newStatus);

    const statusLabels: Record<OrderStatus, { ar: string; en: string }> = {
      PENDING: { ar: 'بانتظار التأكيد', en: 'Awaiting confirmation' },
      ACCEPTED: { ar: 'تم تأكيد طلبك', en: 'Your order was confirmed' },
      PREPARING: { ar: 'جارِ تحضير طلبك', en: 'Your order is being prepared' },
      READY: { ar: 'طلبك جاهز وفي انتظار المندوب', en: 'Your order is ready for pickup' },
      DELIVERING: { ar: 'طلبك في الطريق إليك', en: 'Your order is on its way' },
      COMPLETED: { ar: 'تم تسليم طلبك، بالهنا والشفا', en: 'Your order has been delivered' },
      CANCELLED: { ar: 'تم إلغاء طلبك', en: 'Your order was cancelled' },
    };
    const label = statusLabels[newStatus];
    // Queued, not awaited-synchronously-into-a-DB-write-and-push-call — the
    // order status transition itself (already committed above) must stay
    // fast and reliable regardless of notification delivery, which involves
    // a network call to Expo's push service and shouldn't block this response.
    await this.jobsService.queueOrderNotification({
      userId: order.userId,
      titleAr: label.ar,
      titleEn: label.en,
      bodyAr: `طلب رقم ${id.slice(0, 8)}`,
      bodyEn: `Order ${id.slice(0, 8)}`,
      type: 'ORDER_STATUS',
      data: { orderId: id, status: newStatus },
      orderId: id,
    });

    if (newStatus === 'COMPLETED') {
      await this.jobsService.scheduleDailyStoreReport(order.storeId);
    }

    return updated;
  }
}
