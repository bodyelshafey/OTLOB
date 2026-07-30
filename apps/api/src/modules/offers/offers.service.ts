import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService) {}

  findAll(storeId?: string) {
    return this.prisma.offer.findMany({
      where: { isDeleted: false, isActive: true, ...(storeId ? { storeId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const offer = await this.prisma.offer.findFirst({ where: { id, isDeleted: false } });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  create(dto: CreateOfferDto) {
    return this.prisma.offer.create({ data: dto as any });
  }

  update(id: string, dto: Partial<CreateOfferDto>) {
    return this.prisma.offer.update({ where: { id }, data: dto as any });
  }

  remove(id: string) {
    return this.prisma.offer.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
  }
}
