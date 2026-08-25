import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async findAll(userId: string, page = 1, limit = 30) {
    const where = { userId };
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, total, page, limit, unreadCount };
  }

  async markAsRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
    return { message: 'Marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { message: 'All notifications marked as read' };
  }

  // Broadcast to every admin/super-admin — used for approval-queue alerts
  // (a store owner submitting a special offer / ad for review) where there's
  // no single "owner" of the notification, just "whoever reviews these".
  async notifyAdmins(titleAr: string, titleEn: string, bodyAr?: string, bodyEn?: string, type = 'SYSTEM', data?: Prisma.InputJsonValue) {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { id: true },
    });
    await Promise.all(admins.map((a) => this.create(a.id, titleAr, titleEn, bodyAr, bodyEn, type, data)));
  }

  create(
    userId: string,
    titleAr: string,
    titleEn: string,
    bodyAr?: string,
    bodyEn?: string,
    type: string = 'SYSTEM',
    data?: Prisma.InputJsonValue,
  ) {
    return this.prisma.notification
      .create({
        data: { userId, titleAr, titleEn, bodyAr, bodyEn, type, data },
      })
      .then((notification) => {
        this.realtimeGateway.emitNotification(userId, notification);
        return notification;
      });
  }

  // Idempotent-by-token registration: the same physical device re-registers
  // its token on every app start, and a token can move to a different
  // account if a device is shared/re-logged-in — upsert on the unique
  // token, not on (userId, token), so it always reflects the current owner.
  async registerPushToken(userId: string, token: string, platform: string) {
    return this.prisma.pushToken.upsert({
      where: { token },
      update: { userId, platform, lastUsedAt: new Date() },
      create: { userId, token, platform },
    });
  }

  async unregisterPushToken(token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token } });
    return { message: 'Push token removed' };
  }
}
