import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

const PRIVILEGED_ROLES = ['ADMIN', 'SUPER_ADMIN'];

// Rooms used across the app:
//   user:<userId>      -> personal notifications, "your order status changed"
//   order:<orderId>     -> live tracking for a single order (customer + store + driver)
//   store:<storeId>     -> new-order alerts for a store's dashboard
@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? '*', credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('RealtimeGateway');

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('No token provided');

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      client.join(`user:${payload.sub}`);
      this.logger.log(`Client connected: user ${payload.sub}`);
    } catch (err) {
      this.logger.warn(`Rejected unauthenticated socket: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.data?.userId ?? 'unknown'}`);
  }

  // Previously any authenticated socket could join *any* order/store room
  // just by knowing (or guessing) the id — the REST guards were doing
  // ownership checks for the HTTP endpoints, but nothing equivalent existed
  // here, so the realtime channel was a separate, unguarded path to the
  // same data. These checks mirror the same ownership rules already
  // enforced in orders.service.ts / stores.service.ts.
  @SubscribeMessage('order:subscribe')
  async onSubscribeOrder(@ConnectedSocket() client: Socket, @MessageBody() data: { orderId: string }) {
    const allowed = await this.canAccessOrder(client, data.orderId);
    if (!allowed) return { error: 'Not authorized for this order' };
    client.join(`order:${data.orderId}`);
    return { subscribed: data.orderId };
  }

  @SubscribeMessage('order:unsubscribe')
  onUnsubscribeOrder(@ConnectedSocket() client: Socket, @MessageBody() data: { orderId: string }) {
    client.leave(`order:${data.orderId}`);
    return { unsubscribed: data.orderId };
  }

  @SubscribeMessage('store:subscribe')
  async onSubscribeStore(@ConnectedSocket() client: Socket, @MessageBody() data: { storeId: string }) {
    const allowed = await this.canAccessStore(client, data.storeId);
    if (!allowed) return { error: 'Not authorized for this store' };
    client.join(`store:${data.storeId}`);
    return { subscribed: data.storeId };
  }

  // Previously anyone could emit a location update for any orderId and have
  // it broadcast as if it came from the real driver — a real spoofing risk,
  // not just an information-exposure one. Now only the order's actually
  // assigned driver can emit for that order.
  @SubscribeMessage('driver:location')
  async onDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; lat: number; lng: number },
  ) {
    const userId = client.data?.userId;
    if (!userId) return;
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      select: { driverId: true },
    });
    if (!order?.driverId) return;
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver || driver.id !== order.driverId) return;
    this.emitDriverLocation(data.orderId, data.lat, data.lng);
  }

  // ---- Access checks, mirroring the equivalent REST ownership rules ----

  private async canAccessOrder(client: Socket, orderId: string): Promise<boolean> {
    const userId = client.data?.userId;
    const role = client.data?.role;
    if (!userId) return false;
    if (PRIVILEGED_ROLES.includes(role)) return true;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, storeId: true, driverId: true },
    });
    if (!order) return false;

    if (order.userId === userId) return true; // the customer

    if (order.driverId) {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      if (driver && driver.id === order.driverId) return true; // the assigned driver
    }

    return this.canAccessStore(client, order.storeId); // store owner/staff
  }

  private async canAccessStore(client: Socket, storeId: string): Promise<boolean> {
    const userId = client.data?.userId;
    const role = client.data?.role;
    if (!userId) return false;
    if (PRIVILEGED_ROLES.includes(role)) return true;

    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
    if (!store) return false;
    if (store.ownerId === userId) return true;

    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    return !!membership;
  }

  // ---- Server-side emitters, called from other services ----

  emitOrderStatusChanged(orderId: string, userId: string, storeId: string, status: string) {
    this.server.to(`order:${orderId}`).emit('order:status', { orderId, status });
    this.server.to(`user:${userId}`).emit('order:status', { orderId, status });
    this.server.to(`store:${storeId}`).emit('order:status', { orderId, status });
  }

  emitDriverLocation(orderId: string, lat: number, lng: number) {
    this.server.to(`order:${orderId}`).emit('driver:location', { orderId, lat, lng });
  }

  emitNewOrder(storeId: string, order: unknown) {
    this.server.to(`store:${storeId}`).emit('order:new', order);
  }

  emitNotification(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }
}
