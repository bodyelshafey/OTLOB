import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';

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

  async createPaymentIntent(orderId: string) {
    if (!this.stripe) {
      throw new BadRequestException('Card payments are not configured on this server yet');
    }
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

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

  async confirmCashPayment(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    return this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'PAID' },
    });
  }
}
