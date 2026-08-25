import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from '../../notifications/notifications.service';
import { PushService } from '../../notifications/push.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { JobsService } from '../jobs.service';
import { resolveCampaignTargetUserIds } from '../../../common/notification-targeting';
import { QUEUE_CONCURRENCY } from '../../../config/queue.config';

interface SendNotificationJob {
  userId: string;
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  type?: string;
  data?: Record<string, unknown>;
}

interface SendBulkNotificationJob {
  userIds: string[];
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  type?: string;
  data?: Record<string, unknown>;
}

interface SendCampaignJob {
  campaignId: string;
}

interface CheckPushReceiptsJob {
  ticketIds: string[];
}

// Runs notification writes off the request thread. Useful for high-fan-out
// cases (e.g. an admin campaign to "all users") without blocking the HTTP
// response that triggered them. Each job creates the in-app Notification
// row(s) first (fast, reliable — this is what the notifications bell
// actually reads) and then best-effort sends a push; a push failure never
// rolls back the DB record, since the in-app notification is still valid
// even if the device never got woken up for it.
@Processor('notifications', { concurrency: QUEUE_CONCURRENCY.notifications })
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger('NotificationsProcessor');

  constructor(
    private notificationsService: NotificationsService,
    private pushService: PushService,
    private prisma: PrismaService,
    private jobsService: JobsService,
  ) {
    super();
  }

  async process(
    job: Job<SendNotificationJob | SendBulkNotificationJob | SendCampaignJob | CheckPushReceiptsJob>,
  ) {
    if (job.name === 'send-notification') {
      const { userId, titleAr, titleEn, bodyAr, bodyEn, type, data } = job.data as SendNotificationJob;
      await this.notificationsService.create(userId, titleAr, titleEn, bodyAr, bodyEn, type, data as any);
      const { ticketIds } = await this.pushService
        .sendToUser(userId, titleAr, bodyAr ?? titleAr, data)
        .catch((err) => {
          this.logger.warn(`Push send failed for user ${userId}: ${err.message}`);
          return { ticketIds: [] as string[] };
        });
      await this.jobsService.scheduleReceiptCheck(ticketIds);
      this.logger.log(`Notification delivered to user ${userId}`);
      return;
    }

    if (job.name === 'send-bulk-notification') {
      const { userIds, titleAr, titleEn, bodyAr, bodyEn, type, data } = job.data as SendBulkNotificationJob;
      await this.deliverBulk(userIds, titleAr, titleEn, bodyAr, bodyEn, type, data);
      return;
    }

    if (job.name === 'send-campaign') {
      const { campaignId } = job.data as SendCampaignJob;
      const campaign = await this.prisma.notificationCampaign.findUnique({ where: { id: campaignId } });
      if (!campaign || campaign.status === 'SENT') {
        // Already sent (or deleted before the scheduled time arrived) —
        // nothing to do, and re-sending would duplicate notifications.
        return;
      }

      const userIds = await resolveCampaignTargetUserIds(this.prisma, {
        targetType: campaign.targetType,
        targetRole: campaign.targetRole,
        targetUserId: campaign.targetUserId,
        targetStoreId: campaign.targetStoreId,
      });

      await this.deliverBulk(userIds, campaign.title, campaign.title, campaign.bodyAr, campaign.bodyEn ?? undefined, campaign.type, {
        campaignId: campaign.id,
      });

      await this.prisma.notificationCampaign.update({
        where: { id: campaign.id },
        data: { status: 'SENT', sentAt: new Date(), recipientCount: userIds.length },
      });
      this.logger.log(`Scheduled campaign ${campaign.id} sent to ${userIds.length} users`);
      return;
    }

    if (job.name === 'check-push-receipts') {
      const { ticketIds } = job.data as CheckPushReceiptsJob;
      await this.pushService.checkReceipts(ticketIds);
      this.logger.log(`Checked delivery receipts for ${ticketIds.length} push tickets`);
    }
  }

  private async deliverBulk(
    userIds: string[],
    titleAr: string,
    titleEn: string,
    bodyAr?: string,
    bodyEn?: string,
    type?: string,
    data?: Record<string, unknown>,
  ) {
    // One DB write per recipient (still a single query via createMany), not
    // one job per recipient — keeps the queue itself lightweight even for a
    // large "all users" campaign.
    if (userIds.length > 0) {
      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          titleAr,
          titleEn,
          bodyAr,
          bodyEn,
          type: type ?? 'PROMO',
          data: data as any,
        })),
      });
    }

    const { ticketIds } = await this.pushService
      .sendToUsers(userIds, titleAr, bodyAr ?? titleAr, data)
      .catch((err) => {
        this.logger.warn(`Bulk push send failed: ${err.message}`);
        return { ticketIds: [] as string[] };
      });
    await this.jobsService.scheduleReceiptCheck(ticketIds);

    this.logger.log(`Bulk notification delivered to ${userIds.length} users`);
  }
}
