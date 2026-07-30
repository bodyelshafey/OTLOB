import { Injectable, NotFoundException } from '@nestjs/common';
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

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  update(id: string, dto: Partial<CreateProductDto>) {
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }
}
