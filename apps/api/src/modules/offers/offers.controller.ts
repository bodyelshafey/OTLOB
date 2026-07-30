import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private service: OffersService) {}

  @Public()
  @Get()
  findAll(@Query('storeId') storeId?: string) {
    return this.service.findAll(storeId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateOfferDto) {
    return this.service.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateOfferDto>) {
    return this.service.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
