import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private service: ProductsService) {}

  @Public()
  @Get()
  findAll(
    @Query('storeId') storeId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(storeId, categoryId, search, Number(page) || 1, Number(limit) || 20);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProductDto>) {
    return this.service.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
