import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// Thin facade so other modules (orders, coupons, etc.) don't need to know
// about BullMQ directly — they just call jobsService.xyz(...).
@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('reports') private reportsQueue: Queue,
  ) {}

  async queueOrderNotification(userId: string, titleAr: string, titleEn: string) {
    await this.notificationsQueue.add(
      'send-notification',
      { userId, titleAr, titleEn },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
  }

  async scheduleDailyStoreReport(storeId: string) {
    await this.reportsQueue.add(
      'daily-store-report',
      { storeId },
      { delay: 0, removeOnComplete: true },
    );
  }
}
