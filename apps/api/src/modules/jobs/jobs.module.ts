import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsProcessor } from './processors/notifications.processor';
import { ReportsProcessor } from './processors/reports.processor';
import { DeliveryAutomationProcessor } from './processors/delivery-automation.processor';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    }),
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'reports' },
      { name: 'delivery-automation' },
    ),
    NotificationsModule,
    RealtimeModule,
  ],
  providers: [NotificationsProcessor, ReportsProcessor, DeliveryAutomationProcessor, JobsService],
  exports: [JobsService],
})
export class JobsModule {}
