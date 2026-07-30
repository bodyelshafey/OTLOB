import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: { store: true, product: true },
    });
  }

  async add(userId: string, dto: CreateFavoriteDto) {
    if (!dto.storeId && !dto.productId) {
      throw new BadRequestException('Either storeId or productId is required');
    }
    const existing = await this.prisma.favorite.findFirst({
      where: { userId, storeId: dto.storeId ?? undefined, productId: dto.productId ?? undefined },
    });
    if (existing) return existing;
    return this.prisma.favorite.create({ data: { ...dto, userId } });
  }

  async remove(userId: string, id: string) {
    await this.prisma.favorite.deleteMany({ where: { id, userId } });
    return { message: 'Removed from favorites' };
  }
}
