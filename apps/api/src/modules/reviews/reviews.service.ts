import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  findByStore(storeId: string) {
    return this.prisma.review.findMany({
      where: { storeId },
      include: { user: { select: { fullName: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateReviewDto) {
    const review = await this.prisma.review.create({ data: { ...dto, userId } });
    await this.recalculateStoreRating(dto.storeId);
    return review;
  }

  private async recalculateStoreRating(storeId: string) {
    const agg = await this.prisma.review.aggregate({
      where: { storeId },
      _avg: { rating: true },
    });
    await this.prisma.store.update({
      where: { id: storeId },
      data: { rating: agg._avg.rating ?? 0 },
    });
  }
}
