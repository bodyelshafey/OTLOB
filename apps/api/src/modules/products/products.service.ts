import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(storeId?: string, categoryId?: string, search?: string, page = 1, limit = 20) {
    const where = {
      isDeleted: false,
      ...(storeId ? { storeId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isDeleted: false },
      include: { store: true, category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(userId: string, role: string, dto: CreateProductDto) {
    await this.assertStoreAccess(dto.storeId, userId, role);
    return this.prisma.product.create({ data: dto });
  }

  async update(id: string, userId: string, role: string, dto: Partial<CreateProductDto>) {
    const product = await this.findOne(id);
    await this.assertStoreAccess(product.storeId, userId, role);
    const { storeId: _ignored, ...rest } = dto;
    return this.prisma.product.update({ where: { id }, data: rest });
  }

  async remove(id: string, userId: string, role: string) {
    const product = await this.findOne(id);
    await this.assertStoreAccess(product.storeId, userId, role);
    return this.prisma.product.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  // Same ownership rule as orders/offers/ads: privileged roles manage
  // anything, a STORE_OWNER manages their own store, and an EMPLOYEE needs
  // an actual StoreMember row for that store — not just "any employee".
  private async assertStoreAccess(storeId: string, userId: string, role: string) {
    if (['ADMIN', 'SUPER_ADMIN'].includes(role)) return;
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    if (store.ownerId === userId) return;
    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!membership) throw new ForbiddenException('You do not have access to this store');
  }
}
