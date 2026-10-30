import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
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
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger('JobsService');

  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('reports') private reportsQueue: Queue,
    @InjectQueue('delivery-automation') private deliveryAutomationQueue: Queue,
  ) {}

  // Registers the Phase 8 (2-hour auto-delivery) repeatable scan job once
  // at boot — BullMQ's `repeat` + a stable `jobId` makes this registration
  // itself idempotent: every API instance calls this on startup (in a
  // horizontally-scaled deployment), but BullMQ dedupes identical
  // repeat-config + jobId registrations rather than creating N duplicate
  // schedulers. The scan interval defaults to every 10 minutes — frequent
  // enough that an order is never more than ~10 minutes late past the
  // 2-hour mark, without scanning so often it adds meaningful DB load.
  //
  // Startup-hang fix, 2026-09-26: this used to be `await`ed directly here.
  // Nest calls every provider's onModuleInit() as part of the SAME internal
  // init() that app.listen() triggers *from inside itself* (not before it),
  // so an onModuleInit() that never settles means app.listen() never
  // settles either — no error, no timeout, the HTTP server just never
  // binds. queue.add() needs a "ready" ioredis connection to run its Lua
  // script, and ioredis's default retryStrategy NEVER gives up and NEVER
  // rejects (ioredis just keeps scheduling another retry, forever) — so if
  // Redis is unreachable, or reachable but silently black-holed by a
  // firewall/VPN (which fails completely differently from a fast
  // ECONNREFUSED — no error ever fires), this call used to hang forever
  // and take the entire HTTP API down with it. Fire-and-forget with our
  // own bounded timeout so a Redis problem can only ever delay the
  // auto-delivery scan — never the API's ability to start and serve
  // requests.
  onModuleInit() {
    // Two API instances (e.g. Railway + a developer's local copy) pointed at
    // the SAME database would each schedule their own scan against the same
    // production orders. The scan is state-guarded, but a local instance
    // running unreviewed code shouldn't be mutating shared orders at all —
    // set AUTO_DELIVER_SCAN_ENABLED=false on any non-production instance.
    // Unset/anything else keeps the existing behaviour (enabled).
    if ((process.env.AUTO_DELIVER_SCAN_ENABLED ?? '').trim().toLowerCase() === 'false') {
      this.logger.warn('Auto-delivery scan NOT scheduled (AUTO_DELIVER_SCAN_ENABLED=false)');
      return;
    }
    void this.registerAutoDeliverScanWithRetry();
  }

  private async registerAutoDeliverScanWithRetry(attempt = 1): Promise<void> {
    const intervalMs = Number(process.env.AUTO_DELIVER_SCAN_INTERVAL_MINUTES ?? 10) * 60_000;
    // Generous relative to a healthy connection (which resolves in tens of
    // milliseconds) but short enough to fail fast rather than accumulate a
    // long chain of stuck attempts.
    const timeoutMs = 10_000;
    try {
      await this.withTimeout(
        this.deliveryAutomationQueue.add(
          'auto-deliver-scan',
          {},
          { repeat: { every: intervalMs }, jobId: 'auto-deliver-scan' },
        ),
        timeoutMs,
      );
      this.logger.log(`Auto-delivery scan scheduled every ${intervalMs / 60_000} minute(s)`);
    } catch (err) {
      const delay = Math.min(2 ** Math.min(attempt, 5) * 1000, 30_000);
      this.logger.warn(
        `Could not confirm Redis is ready to schedule the auto-delivery scan (attempt ${attempt}: ${(err as Error).message}) — retrying in ${delay / 1000}s. The API keeps starting/serving requests normally in the meantime; only the 2-hour auto-delivery scan is affected until this succeeds.`,
      );
      setTimeout(() => {
        this.registerAutoDeliverScanWithRetry(attempt + 1).catch(() => {
          // registerAutoDeliverScanWithRetry only ever rejects if setTimeout's
          // callback itself throws synchronously, which it can't here — this
          // catch exists purely so a future refactor can't turn this into an
          // unhandled rejection by accident.
        });
      }, delay);
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`timed out after ${ms}ms waiting on Redis`)), ms),
      ),
    ]);
  }

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
