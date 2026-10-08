import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Post('intent')
  createIntent(@Body('orderId') orderId: string, @CurrentUser('id') userId: string) {
    return this.service.createPaymentIntent(orderId, userId);
  }

  @Post('cash-confirm')
  confirmCash(
    @Body('orderId') orderId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.confirmCashPayment(orderId, userId, role);
  }
}
