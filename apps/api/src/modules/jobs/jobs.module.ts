import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsProcessor } from './processors/notifications.processor';
import { ReportsProcessor } from './processors/reports.processor';
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
    ),
    NotificationsModule,
  ],
  providers: [NotificationsProcessor, ReportsProcessor, JobsService],
  exports: [JobsService],
})
export class JobsModule {}
