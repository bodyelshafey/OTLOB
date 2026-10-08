import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreTypeDto } from './dto/create-store-type.dto';

@Injectable()
export class StoreTypesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.storeType.findMany({ orderBy: { nameEn: 'asc' } });
  }

  async findOne(id: string) {
    const item = await this.prisma.storeType.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Store type not found');
    return item;
  }

  create(dto: CreateStoreTypeDto) {
    return this.prisma.storeType.create({ data: dto });
  }

  update(id: string, dto: Partial<CreateStoreTypeDto>) {
    return this.prisma.storeType.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.storeType.delete({ where: { id } });
  }
}
