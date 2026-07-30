import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
    return { message: 'Marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { message: 'All notifications marked as read' };
  }

  create(userId: string, titleAr: string, titleEn: string, bodyAr?: string, bodyEn?: string) {
    return this.prisma.notification
      .create({
        data: { userId, titleAr, titleEn, bodyAr, bodyEn },
      })
      .then((notification) => {
        this.realtimeGateway.emitNotification(userId, notification);
        return notification;
      });
  }
}
