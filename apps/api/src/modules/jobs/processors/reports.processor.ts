import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';

interface DailyReportJob {
  storeId: string;
}

// Rolls up yesterday's completed orders into store_daily_stats so store
// dashboards can show fast historical charts without aggregating raw
// orders on every page load.
@Processor('reports')
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

    const orders = await this.prisma.order.findMany({
      where: {
        storeId,
        orderStatus: 'COMPLETED',
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const revenue = orders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const commission = orders.reduce((sum, o) => sum + Number(o.commission), 0);

    await this.prisma.storeDailyStat.upsert({
      where: { storeId_date: { storeId, date: startOfDay } },
      update: { ordersCount: orders.length, revenue, commission },
      create: { storeId, date: startOfDay, ordersCount: orders.length, revenue, commission },
    });

    this.logger.log(`Daily report generated for store ${storeId}: ${orders.length} orders`);
  }
}
