import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class RejectAdDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class SetMonthlyLimitDto {
  @IsInt()
  @Min(1)
  value!: number;
}

@ApiTags('ads')
@Controller('ads')
export class AdsController {
  constructor(private service: AdsService) {}

  // Public — what the carousel actually renders.
  @Public()
  @Get()
  findActive(@Query('storeId') storeId?: string) {
    return this.service.findActive(storeId);
  }

  // Management list (own store's ads for STORE_OWNER, all/filtered for admin).
  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('mine')
  findMine(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.service.findAll(userId, role, storeId);
  }

  // Store-owner dashboard: monthly limit, used, remaining, and a status breakdown.
  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('quota')
  getQuota(@CurrentUser('id') userId: string, @CurrentUser('role') role: string, @Query('storeId') storeId: string) {
    return this.service.getQuota(userId, role, storeId);
  }

  // Admin review queue.
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('pending')
  findPending(@Query('storeId') storeId?: string) {
    return this.service.findPending(storeId);
  }

  // Admin-configurable global default monthly limit.
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('settings/monthly-limit')
  getGlobalMonthlyLimit() {
    return this.service.getGlobalMonthlyLimit().then((value) => ({ value }));
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch('settings/monthly-limit')
  setGlobalMonthlyLimit(@CurrentUser('role') role: string, @Body() dto: SetMonthlyLimitDto) {
    return this.service.setGlobalMonthlyLimit(role, dto.value);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  create(@CurrentUser('id') userId: string, @CurrentUser('role') role: string, @Body() dto: CreateAdDto) {
    return this.service.create(userId, role, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: Partial<CreateAdDto>,
  ) {
    return this.service.update(id, userId, role, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: string) {
    return this.service.remove(id, userId, role);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: string) {
    return this.service.toggleActive(id, userId, role);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser('id') adminId: string, @CurrentUser('role') role: string) {
    return this.service.approve(id, adminId, role);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') role: string,
    @Body() dto: RejectAdDto,
  ) {
    return this.service.reject(id, adminId, role, dto.reason);
  }
}
