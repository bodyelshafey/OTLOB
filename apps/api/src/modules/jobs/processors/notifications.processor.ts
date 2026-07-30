import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '../../notifications/notifications.service';

interface SendNotificationJob {
  userId: string;
  titleAr: string;
  titleEn: string;
}

// Runs notification writes off the request thread. Useful for high-fan-out
// cases (e.g. "notify all users a new store opened") without blocking the
// HTTP response that triggered them.
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger('NotificationsProcessor');

  constructor(private notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<SendNotificationJob>) {
    if (job.name !== 'send-notification') return;
    const { userId, titleAr, titleEn } = job.data;
    await this.notificationsService.create(userId, titleAr, titleEn);
    this.logger.log(`Notification delivered to user ${userId}`);
  }
}
