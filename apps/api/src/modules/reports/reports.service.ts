import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async storeSummary(storeId: string, requesterId: string, role: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, include: { settings: true } });
    if (!store) throw new NotFoundException('Store not found');
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    if (!isPrivileged && store.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this store');
    }

    const [ordersCount, revenueAgg, ratingAgg] = await Promise.all([
      this.prisma.order.count({ where: { storeId, orderStatus: 'COMPLETED' } }),
      this.prisma.order.aggregate({
        where: { storeId, orderStatus: 'COMPLETED' },
        _sum: { subtotal: true, commission: true },
      }),
      this.prisma.review.aggregate({ where: { storeId }, _avg: { rating: true }, _count: true }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.subtotal ?? 0);
    const totalCommissionPaid = Number(revenueAgg._sum.commission ?? 0);
    const commissionPercentage = Number(store.settings?.commissionPercentage ?? 10);

    return {
      ordersCompleted: ordersCount,
      totalRevenue,
      commissionPercentage,
      totalCommissionPaid,
      // Net amount owed *to the merchant* after the platform's commission —
      // a plain arithmetic view of the two backend-computed numbers above,
      // not a separately trusted figure.
      netEarnings: totalRevenue - totalCommissionPaid,
      averageRating: ratingAgg._avg.rating ?? 0,
      reviewsCount: ratingAgg._count,
    };
  }

  // Last N days of commission/revenue for one store, from the daily-stats
  // table the BullMQ report job already populates after each completed
  // order (jobs/processors/reports.processor.ts) — no new aggregation path.
  async storeDailyBreakdown(storeId: string, requesterId: string, role: string, days = 14) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    if (!isPrivileged && store.ownerId !== requesterId) {
      throw new ForbiddenException('You do not own this store');
    }
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.prisma.storeDailyStat.findMany({
      where: { storeId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
  }

  async platformSummary() {
    const [usersCount, storesCount, ordersCount, revenueAgg] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.store.count({ where: { isDeleted: false } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        where: { orderStatus: 'COMPLETED' },
        _sum: { total: true, commission: true },
      }),
    ]);

    return {
      usersCount,
      storesCount,
      ordersCount,
      totalGMV: revenueAgg._sum.total ?? 0,
      totalCommissionEarned: revenueAgg._sum.commission ?? 0,
    };
  }

  // Commission earned per store — lets admin see who owes/generated what,
  // and surfaces stores with zero completed orders too (left join via
  // groupBy would drop them, so this starts from Store and aggregates).
  async platformCommissionByStore() {
    // Independent queries — no reason to wait for stores before starting
    // the orders aggregation.
    const [stores, sums] = await Promise.all([
      this.prisma.store.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true, settings: { select: { commissionPercentage: true } } },
      }),
      this.prisma.order.groupBy({
        by: ['storeId'],
        where: { orderStatus: 'COMPLETED' },
        _sum: { subtotal: true, commission: true },
        _count: true,
      }),
    ]);
    const byStore = new Map(sums.map((s) => [s.storeId, s]));

    return stores
      .map((store) => {
        const agg = byStore.get(store.id);
        return {
          storeId: store.id,
          storeName: store.name,
          commissionPercentage: Number(store.settings?.commissionPercentage ?? 10),
          ordersCompleted: agg?._count ?? 0,
          totalRevenue: Number(agg?._sum.subtotal ?? 0),
          totalCommission: Number(agg?._sum.commission ?? 0),
        };
      })
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }
}
