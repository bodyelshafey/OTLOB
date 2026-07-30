import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Post('intent')
  createIntent(@Body('orderId') orderId: string) {
    return this.service.createPaymentIntent(orderId);
  }

  @Post('cash-confirm')
  confirmCash(@Body('orderId') orderId: string) {
    return this.service.confirmCashPayment(orderId);
  }
}
