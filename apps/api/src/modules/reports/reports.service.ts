import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async storeSummary(storeId: string, requesterId: string, role: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
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

    return {
      ordersCompleted: ordersCount,
      totalRevenue: revenueAgg._sum.subtotal ?? 0,
      totalCommissionPaid: revenueAgg._sum.commission ?? 0,
      averageRating: ratingAgg._avg.rating ?? 0,
      reviewsCount: ratingAgg._count,
    };
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
}
