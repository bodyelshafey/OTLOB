import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientIp } from '../../common/decorators/client-ip.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class RejectOfferDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private service: OffersService) {}

  // ?home=true → homepage "Today's Offers" (featured + approved only).
  // Otherwise unfiltered by featured/approval status, same as before.
  @Public()
  @Get()
  findAll(@Query('storeId') storeId?: string, @Query('home') home?: string) {
    return this.service.findAll(storeId, home === 'true');
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('mine')
  findManaged(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.service.findManaged(userId, role, storeId);
  }

  // Admin review queue for featured-offer requests.
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('pending')
  findPending(@Query('storeId') storeId?: string) {
    return this.service.findPending(storeId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  create(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.service.create(userId, role, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: Partial<CreateOfferDto>,
  ) {
    return this.service.update(id, userId, role, dto);
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
    @Body() dto: RejectOfferDto,
  ) {
    return this.service.reject(id, adminId, role, dto.reason);
  }
}
