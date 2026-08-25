import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { QUEUE_CONCURRENCY } from '../../../config/queue.config';

interface DailyReportJob {
  storeId: string;
}

// Rolls up yesterday's completed orders into store_daily_stats so store
// dashboards can show fast historical charts without aggregating raw
// orders on every page load.
@Processor('reports', { concurrency: QUEUE_CONCURRENCY.reports })
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger('ReportsProcessor');

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<DailyReportJob>) {
    if (job.name !== 'daily-store-report') return;
    const { storeId } = job.data;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // DB-side aggregation instead of fetching every completed order row for
    // the day (all columns) just to sum two fields in JS — a store with a
    // few hundred orders in a day was pulling that entire dataset into
    // Node memory for no reason. count/_sum both run in one query.
    const result = await this.prisma.order.aggregate({
      where: {
        storeId,
        orderStatus: 'COMPLETED',
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      _sum: { subtotal: true, commission: true },
      _count: true,
    });

    const revenue = Number(result._sum.subtotal ?? 0);
    const commission = Number(result._sum.commission ?? 0);
    const ordersCount = result._count;

    await this.prisma.storeDailyStat.upsert({
      where: { storeId_date: { storeId, date: startOfDay } },
      update: { ordersCount, revenue, commission },
      create: { storeId, date: startOfDay, ordersCount, revenue, commission },
    });

    this.logger.log(`Daily report generated for store ${storeId}: ${ordersCount} orders`);
  }
}
