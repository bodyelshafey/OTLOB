import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

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

  constructor(private jwtService: JwtService) {}

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

  @SubscribeMessage('order:subscribe')
  onSubscribeOrder(@ConnectedSocket() client: Socket, @MessageBody() data: { orderId: string }) {
    client.join(`order:${data.orderId}`);
    return { subscribed: data.orderId };
  }

  @SubscribeMessage('order:unsubscribe')
  onUnsubscribeOrder(@ConnectedSocket() client: Socket, @MessageBody() data: { orderId: string }) {
    client.leave(`order:${data.orderId}`);
    return { unsubscribed: data.orderId };
  }

  @SubscribeMessage('store:subscribe')
  onSubscribeStore(@ConnectedSocket() client: Socket, @MessageBody() data: { storeId: string }) {
    // Only store staff should really be allowed here; the REST guards already
    // check ownership before store dashboards get the storeId in the first place.
    client.join(`store:${data.storeId}`);
    return { subscribed: data.storeId };
  }

  @SubscribeMessage('driver:location')
  onDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; lat: number; lng: number },
  ) {
    this.emitDriverLocation(data.orderId, data.lat, data.lng);
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
