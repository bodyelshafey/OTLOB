import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  findAll(storeTypeId?: string, storeId?: string) {
    return this.prisma.category.findMany({
      where: {
        ...(storeTypeId ? { storeTypeId } : {}),
        ...(storeId ? { storeId } : {}),
      },
      orderBy: { nameEn: 'asc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.category.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Category not found');
    return item;
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }

  update(id: string, dto: Partial<CreateCategoryDto>) {
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }
}
