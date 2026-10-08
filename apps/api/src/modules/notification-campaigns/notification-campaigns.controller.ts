import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { NotificationCampaignsService } from './notification-campaigns.service';
import { CreateNotificationCampaignDto } from './dto/create-campaign.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

// Admin-only end to end — every route here requires ADMIN/SUPER_ADMIN, and
// "who to notify" is always resolved server-side from the campaign's own
// targeting fields, never from a client-supplied list of user ids.
@ApiTags('admin-notification-campaigns')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/notification-campaigns')
export class NotificationCampaignsController {
  constructor(private service: NotificationCampaignsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateNotificationCampaignDto) {
    return this.service.create(userId, dto);
  }

  @Post('preview-audience')
  previewAudience(@Body() dto: CreateNotificationCampaignDto) {
    return this.service.previewAudienceSize(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateNotificationCampaignDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // Fan-out to potentially every user on the platform — throttled tighter
  // than a typical admin mutation so a mistake (or a compromised admin
  // session) can't blast repeated campaigns in a loop.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post(':id/send')
  sendNow(@Param('id') id: string) {
    return this.service.sendNow(id);
  }
}
