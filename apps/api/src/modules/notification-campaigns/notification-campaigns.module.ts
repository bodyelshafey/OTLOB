import { Module } from '@nestjs/common';
import { NotificationCampaignsService } from './notification-campaigns.service';
import { NotificationCampaignsController } from './notification-campaigns.controller';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [JobsModule],
  controllers: [NotificationCampaignsController],
  providers: [NotificationCampaignsService],
})
export class NotificationCampaignsModule {}
