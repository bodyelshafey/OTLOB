import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.service.findAll(userId);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.markAsRead(userId, id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.service.markAllAsRead(userId);
  }
}
