import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { JobsService } from '../jobs/jobs.service';
import { CreateOrderDto } from './dto/create-order.dto';

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
    private notificationsService: NotificationsService,
    private jobsService: JobsService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    // Checkout runs as a single DB transaction: read cart -> validate -> compute totals -> persist -> clear cart
    return this.prisma.$transaction(async (tx) => {
      const cartItems = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true, offer: true },
      });

      const storeItems = cartItems.filter(
        (item) => item.product?.storeId === dto.storeId,
      );

      if (storeItems.length === 0) {
        throw new BadRequestException('Cart is empty for this store');
      }

      const store = await tx.store.findUnique({
        where: { id: dto.storeId },
        include: { settings: true },
      });
      if (!store || store.isDeleted) throw new NotFoundException('Store not found');
      if (!store.isOpen) throw new BadRequestException('Store is currently closed');

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
    });
  }

  async findStoreOrders(storeId: string) {
    return this.prisma.order.findMany({
      where: { storeId },
      include: { items: true, user: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
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

  async updateStatus(id: string, newStatus: OrderStatus, changedBy: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

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
    await this.notificationsService.create(
      order.userId,
      label.ar,
      label.en,
      `طلب رقم ${id.slice(0, 8)}`,
      `Order ${id.slice(0, 8)}`,
    );

    if (newStatus === 'COMPLETED') {
      await this.jobsService.scheduleDailyStoreReport(order.storeId);
    }

    return updated;
  }
}
