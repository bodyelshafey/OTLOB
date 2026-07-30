import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { QueryStoreDto } from './dto/query-store.dto';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryStoreDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const where = {
      isDeleted: false,
      ...(query.storeTypeId ? { storeTypeId: query.storeTypeId } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { rating: 'desc' },
        include: { storeType: true },
      }),
      this.prisma.store.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  findMine(ownerId: string) {
    return this.prisma.store.findMany({
      where: { ownerId, isDeleted: false },
      include: { storeType: true },
    });
  }

  async findOne(id: string) {
    const store = await this.prisma.store.findFirst({
      where: { id, isDeleted: false },
      include: { storeType: true, categories: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  create(ownerId: string, dto: CreateStoreDto) {
    return this.prisma.store.create({
      data: { ...dto, ownerId },
    });
  }

  async update(id: string, userId: string, userRole: string, dto: Partial<CreateStoreDto>) {
    await this.assertOwnership(id, userId, userRole);
    return this.prisma.store.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string, userRole: string) {
    await this.assertOwnership(id, userId, userRole);
    return this.prisma.store.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  async toggleOpen(id: string, userId: string, userRole: string) {
    const store = await this.assertOwnership(id, userId, userRole);
    return this.prisma.store.update({ where: { id }, data: { isOpen: !store.isOpen } });
  }

  private async assertOwnership(id: string, userId: string, userRole: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    if (!isPrivileged && store.ownerId !== userId) {
      throw new ForbiddenException('You do not own this store');
    }
    return store;
  }
}
