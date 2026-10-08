import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: true, offer: true },
      orderBy: { createdAt: 'desc' },
    });

    const subtotal = items.reduce((sum, item) => {
      const price = item.product?.price ?? item.offer?.newPrice ?? 0;
      return sum + Number(price) * item.quantity;
    }, 0);

    return { items, subtotal };
  }

  async addItem(userId: string, dto: AddToCartDto) {
    if (!dto.productId && !dto.offerId) {
      throw new BadRequestException('Either productId or offerId is required');
    }

    const existing = await this.prisma.cartItem.findFirst({
      where: { userId, productId: dto.productId ?? undefined, offerId: dto.offerId ?? undefined },
    });

    if (existing) {
      return this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + dto.quantity },
      });
    }

    return this.prisma.cartItem.create({
      data: {
        userId,
        productId: dto.productId,
        offerId: dto.offerId,
        quantity: dto.quantity,
        note: dto.note,
      },
    });
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException('Cart item not found');
    return this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, userId } });
    if (!item) throw new NotFoundException('Cart item not found');
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return { message: 'Item removed' };
  }

  async clearCart(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return { message: 'Cart cleared' };
  }
}
