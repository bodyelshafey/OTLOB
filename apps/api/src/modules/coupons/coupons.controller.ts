import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('coupons')
@ApiBearerAuth()
@Controller('coupons')
export class CouponsController {
  constructor(private service: CouponsService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.service.create(dto);
  }

  @Get('validate/:code')
  validate(@Param('code') code: string, @Query('orderValue') orderValue: string) {
    return this.service.validate(code, Number(orderValue) || 0);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
