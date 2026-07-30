import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateOrderDto) {
    return this.service.create(userId, dto);
  }

  @Get('me')
  findMyOrders(@CurrentUser('id') userId: string) {
    return this.service.findMyOrders(userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('store/:storeId')
  findStoreOrders(@Param('storeId') storeId: string) {
    return this.service.findStoreOrders(storeId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.findOne(id, userId, role);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.STORE_OWNER, UserRole.EMPLOYEE, UserRole.DRIVER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.updateStatus(id, dto.status, userId);
  }
}
