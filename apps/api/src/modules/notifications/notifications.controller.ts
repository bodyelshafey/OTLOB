import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAll(userId, Number(page) || 1, Number(limit) || 30);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.markAsRead(userId, id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.service.markAllAsRead(userId);
  }

  // A device registers its own token for its own account only — the
  // userId always comes from the authenticated caller, never the body, so
  // there's no way to register a push token against someone else's account.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('push-token')
  registerPushToken(@CurrentUser('id') userId: string, @Body() dto: RegisterPushTokenDto) {
    return this.service.registerPushToken(userId, dto.token, dto.platform);
  }

  @Delete('push-token')
  unregisterPushToken(@Body() dto: Pick<RegisterPushTokenDto, 'token'>) {
    return this.service.unregisterPushToken(dto.token);
  }
}
