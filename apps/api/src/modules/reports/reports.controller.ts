import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('store/:storeId')
  storeSummary(
    @Param('storeId') storeId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.storeSummary(storeId, userId, role);
  }

  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('store/:storeId/daily')
  storeDailyBreakdown(
    @Param('storeId') storeId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('days') days?: string,
  ) {
    return this.service.storeDailyBreakdown(storeId, userId, role, days ? Number(days) : undefined);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('platform')
  platformSummary() {
    return this.service.platformSummary();
  }

  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('platform/by-store')
  platformCommissionByStore() {
    return this.service.platformCommissionByStore();
  }
}
