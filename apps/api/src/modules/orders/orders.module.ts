import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [NotificationsModule, JobsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
