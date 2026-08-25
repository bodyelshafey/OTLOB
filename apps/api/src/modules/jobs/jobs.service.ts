import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface QueueNotificationPayload {
  userId: string;
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  type?: string;
  data?: Record<string, unknown>;
}

interface QueueBulkNotificationPayload {
  userIds: string[];
  titleAr: string;
  titleEn: string;
  bodyAr?: string;
  bodyEn?: string;
  type?: string;
  data?: Record<string, unknown>;
}

// Thin facade so other modules (orders, coupons, etc.) don't need to know
// about BullMQ directly — they just call jobsService.xyz(...).
@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('reports') private reportsQueue: Queue,
  ) {}

  // Idempotency key mixes in the order id + target status so a BullMQ retry
  // of the same job (after a transient failure) can't double-fire — but two
  // genuinely different status changes for the same order still each queue.
  async queueOrderNotification(payload: QueueNotificationPayload & { orderId?: string }) {
    const jobId = payload.orderId && payload.data?.status
      ? `order-${payload.orderId}-${payload.data.status}`
      : undefined;
    await this.notificationsQueue.add('send-notification', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      jobId,
    });
  }

  // Used by admin notification campaigns for ALL/ROLE/STORE_CUSTOMERS
  // targeting — one job per batch of recipients rather than one job per
  // user, so sending to thousands of users doesn't create thousands of
  // individual BullMQ jobs.
  async queueBulkNotification(payload: QueueBulkNotificationPayload) {
    await this.notificationsQueue.add('send-bulk-notification', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  // Scheduled campaigns resolve their audience at send time (not at
  // schedule time) so someone who signs up between now and the scheduled
  // time is still included — the job only carries the campaign id, and the
  // processor re-resolves targets when it actually fires.
  async scheduleCampaign(campaignId: string, sendAt: Date) {
    const delay = Math.max(0, sendAt.getTime() - Date.now());
    await this.notificationsQueue.add(
      'send-campaign',
      { campaignId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, delay, jobId: `campaign-${campaignId}` },
    );
  }

  async scheduleDailyStoreReport(storeId: string) {
    // Multiple orders can complete for the same store within moments of
    // each other, each calling this — dedupe by store+day so that doesn't
    // enqueue N redundant recomputations of the same daily stats row.
    const today = new Date().toISOString().slice(0, 10);
    await this.reportsQueue.add(
      'daily-store-report',
      { storeId },
      {
        delay: 0,
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        jobId: `daily-report-${storeId}-${today}`,
      },
    );
  }

  // Expo's push receipts aren't available immediately after sending — they
  // recommend waiting at least ~15 minutes before checking. This runs as a
  // separate delayed job rather than blocking the send job itself.
  async scheduleReceiptCheck(ticketIds: string[]) {
    if (ticketIds.length === 0) return;
    await this.notificationsQueue.add(
      'check-push-receipts',
      { ticketIds },
      { delay: 20 * 60_000, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
    );
  }
}
