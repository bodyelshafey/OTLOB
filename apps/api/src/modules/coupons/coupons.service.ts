import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: { ...dto, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined },
    });
  }

  async validate(code: string, orderValue: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.isActive) throw new NotFoundException('Invalid coupon code');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (coupon.minOrderValue && orderValue < Number(coupon.minOrderValue)) {
      throw new BadRequestException(`Minimum order value is ${coupon.minOrderValue}`);
    }
    const discount =
      coupon.discountType === 'percentage'
        ? (orderValue * Number(coupon.discountValue)) / 100
        : Number(coupon.discountValue);
    return { coupon, discount: Math.min(discount, orderValue) };
  }

  remove(id: string) {
    return this.prisma.coupon.delete({ where: { id } });
  }
}
