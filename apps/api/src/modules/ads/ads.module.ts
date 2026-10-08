import { Module } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';
import { BannersService } from './banners.service';
import { BannersController } from './banners.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditLogModule, NotificationsModule],
  controllers: [AdsController, BannersController],
  providers: [AdsService, BannersService],
})
export class AdsModule {}
