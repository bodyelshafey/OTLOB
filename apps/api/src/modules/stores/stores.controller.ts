import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { QueryStoreDto } from './dto/query-store.dto';
import { SetCommissionDto } from './dto/set-commission.dto';
import { SetWorkingHoursDto } from './dto/set-working-hours.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientIp } from '../../common/decorators/client-ip.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('stores')
@Controller('stores')
export class StoresController {
  constructor(private service: StoresService) {}

  @Public()
  @Get()
  findAll(@Query() query: QueryStoreDto) {
    return this.service.findAll(query);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('mine')
  findMine(@CurrentUser('id') userId: string) {
    return this.service.findMine(userId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Public()
  @Get(':id/hours')
  getWorkingHours(@Param('id') id: string) {
    return this.service.getWorkingHours(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/hours')
  setWorkingHours(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: SetWorkingHoursDto,
  ) {
    return this.service.setWorkingHours(id, userId, role, dto.days);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateStoreDto) {
    return this.service.create(userId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: Partial<CreateStoreDto>,
    @ClientIp() ip?: string,
  ) {
    return this.service.update(id, userId, role, dto, ip);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/toggle-open')
  toggleOpen(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: string) {
    return this.service.toggleOpen(id, userId, role);
  }

  // Admin-only — a merchant cannot set their own commission rate.
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/commission')
  setCommission(
    @Param('id') id: string,
    @Body() dto: SetCommissionDto,
    @CurrentUser('id') userId: string,
    @ClientIp() ip?: string,
  ) {
    return this.service.setCommission(id, dto.percentage, userId, ip);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @ClientIp() ip?: string,
  ) {
    return this.service.remove(id, userId, role, ip);
  }
}
