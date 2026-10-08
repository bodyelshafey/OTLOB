import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { JobsService } from '../jobs.service';
import { QUEUE_CONCURRENCY } from '../../../config/queue.config';

const AUTO_DELIVER_AFTER_MS = Number(process.env.AUTO_DELIVER_AFTER_MINUTES ?? 120) * 60_000;

// The 2-hour auto-delivery rule (Phase 8, 2026-09-13): a repeatable
// server-side job — never a frontend timer, never dependent on any
// browser/dashboard being open — that scans for orders stuck in
// DELIVERING for too long and marks them COMPLETED automatically, UNLESS
// a cashier flagged a problem (hasIssue) on that specific order. See
// JobsService.registerScheduledJobs for how this gets scheduled to run
// repeatedly.
@Processor('delivery-automation', { concurrency: QUEUE_CONCURRENCY.deliveryAutomation })
export class DeliveryAutomationProcessor extends WorkerHost {
  private readonly logger = new Logger('DeliveryAutomationProcessor');

  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
    private jobsService: JobsService,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name !== 'auto-deliver-scan') return;

    const cutoff = new Date(Date.now() - AUTO_DELIVER_AFTER_MS);

    // Step 1: find CANDIDATES only — this SELECT is not itself the
    // decision. The actual transition happens per-candidate in step 2 via
    // a conditional UPDATE, so anything that changed between this SELECT
    // and that UPDATE (a cashier reporting a problem seconds ago, the
    // order somehow already being COMPLETED/CANCELLED) is caught safely.
    const candidates = await this.prisma.order.findMany({
      where: { orderStatus: 'DELIVERING', hasIssue: false, updatedAt: { lt: cutoff } },
      select: { id: true, userId: true, storeId: true, driverId: true },
    });

    if (candidates.length === 0) return;

    let deliveredCount = 0;
    for (const order of candidates) {
      // Step 2: the actual safety check, as one atomic conditional
      // UPDATE — re-verifies orderStatus is STILL 'DELIVERING' and
      // hasIssue is STILL false at the moment of the write, not just at
      // SELECT time. count === 0 means something changed in between
      // (issue reported, already delivered by a human, cancelled, etc.)
      // — skip it silently, don't force it. This is also what makes
      // re-running the whole scan safe: a re-run's UPDATE simply matches
      // zero rows for anything already handled, so nothing can be
      // double-processed or corrupted by the job firing more than once.
      //
      // Prisma's updateMany() is required here to express that extra
      // WHERE guard (order.update() only accepts a unique-field where),
      // but updateMany() doesn't support nested relation writes — so the
      // OrderStatusHistory row is created as a separate statement,
      // wrapped in the same transaction as the guarded update so the two
      // writes commit or roll back together (no order flipped to
      // COMPLETED without its history row, and no orphan history row if
      // the guard fails). The history create is itself gated on
      // updateResult.count > 0, so a retried/re-run job — whose
      // updateMany matches zero rows because the order is no longer
      // DELIVERING — never creates a duplicate COMPLETED history entry.
      const result = await this.prisma.$transaction(async (tx) => {
        const updateResult = await tx.order.updateMany({
          where: { id: order.id, orderStatus: 'DELIVERING', hasIssue: false },
          data: { orderStatus: 'COMPLETED' },
        });

        if (updateResult.count > 0) {
          await tx.orderStatusHistory.create({
            data: { orderId: order.id, status: 'COMPLETED', changedBy: 'system:auto-delivery' },
          });
        }

        return updateResult;
      });
      if (result.count === 0) continue;

      deliveredCount++;
      if (order.driverId) {
        await this.prisma.driver.update({ where: { id: order.driverId }, data: { status: 'AVAILABLE' } });
      }
      this.realtimeGateway.emitOrderStatusChanged(order.id, order.userId, order.storeId, 'COMPLETED' as any);
      await this.jobsService.queueOrderNotification({
        userId: order.userId,
        titleAr: 'تم تسليم طلبك، بالهنا والشفا',
        titleEn: 'Your order has been delivered',
        type: 'ORDER_STATUS',
        data: { orderId: order.id, status: 'COMPLETED' },
        orderId: order.id,
      });
    }

    this.logger.log(
      `Auto-delivery scan: ${candidates.length} candidate(s), ${deliveredCount} actually transitioned`,
    );
  }
}
