import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private service: CategoriesService) {}

  @Public()
  @Get()
  findAll(@Query('storeTypeId') storeTypeId?: string, @Query('storeId') storeId?: string) {
    return this.service.findAll(storeTypeId, storeId);
  }

  // Management listing — includes inactive categories, scoped to the
  // caller's own store(s) unless privileged.
  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('mine')
  findAllManaged(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.service.findAllManaged(userId, role, storeId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STORE_OWNER)
  @Post()
  create(@CurrentUser('id') userId: string, @CurrentUser('role') role: string, @Body() dto: CreateCategoryDto) {
    return this.service.create(userId, role, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STORE_OWNER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: Partial<CreateCategoryDto>,
  ) {
    return this.service.update(id, userId, role, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STORE_OWNER)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string, @CurrentUser('role') role: string) {
    return this.service.remove(id, userId, role);
  }
}
