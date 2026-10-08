import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';

const PRIVILEGED = ['ADMIN', 'SUPER_ADMIN'];

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(private prisma: PrismaService) {
    // Stripe client is only constructed if a key is configured; card payments
    // will 400 gracefully instead of crashing the app when not configured yet.
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    }
  }

  // Neither endpoint here checked who was calling — any authenticated user
  // could generate a payment intent for, or mark as PAID, literally any
  // order by guessing/enumerating an orderId. Only the customer who placed
  // the order can initiate paying for it.
  async createPaymentIntent(orderId: string, userId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Card payments are not configured on this server yet');
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('This is not your order');

    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(Number(order.total) * 100),
      currency: 'egp',
      metadata: { orderId },
    });

    await this.prisma.payment.upsert({
      where: { orderId },
      update: { stripeIntentId: intent.id, amount: order.total },
      create: { orderId, stripeIntentId: intent.id, amount: order.total },
    });

    return { clientSecret: intent.client_secret };
  }

  // Confirming cash was actually received belongs to the store's own staff
  // (owner/employee) or the delivering driver — never the customer
  // themselves, and never an unrelated account.
  async confirmCashPayment(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!PRIVILEGED.includes(role)) {
      if (role === 'DRIVER') {
        const driver = await this.prisma.driver.findUnique({ where: { userId } });
        if (!driver || order.driverId !== driver.id) {
          throw new ForbiddenException('You are not the assigned driver for this order');
        }
      } else {
        const store = await this.prisma.store.findUnique({ where: { id: order.storeId } });
        if (!store) throw new NotFoundException('Store not found');
        const isOwner = store.ownerId === userId;
        const membership = isOwner
          ? null
          : await this.prisma.storeMember.findUnique({ where: { storeId_userId: { storeId: order.storeId, userId } } });
        if (!isOwner && !membership) throw new ForbiddenException('You do not have access to this order');
      }
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'PAID' },
    });
  }
}
