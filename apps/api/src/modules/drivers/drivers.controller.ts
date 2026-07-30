import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DriverStatus, UserRole } from '@prisma/client';
import { DriversService } from './drivers.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('drivers')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('drivers')
export class DriversController {
  constructor(private service: DriversService) {}

  @Post('register')
  register(
    @CurrentUser('id') userId: string,
    @Body() body: { vehicleType?: string; plateNumber?: string },
  ) {
    return this.service.registerAsDriver(userId, body.vehicleType, body.plateNumber);
  }

  @Roles(UserRole.DRIVER)
  @Patch('status')
  updateStatus(@CurrentUser('id') userId: string, @Body('status') status: DriverStatus) {
    return this.service.updateStatus(userId, status);
  }

  @Roles(UserRole.DRIVER)
  @Patch('location')
  updateLocation(@CurrentUser('id') userId: string, @Body() body: { lat: number; lng: number }) {
    return this.service.updateLocation(userId, body.lat, body.lng);
  }

  @Roles(UserRole.DRIVER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('available-orders')
  availableOrders() {
    return this.service.availableOrders();
  }

  @Roles(UserRole.DRIVER)
  @Post('orders/:orderId/accept')
  acceptOrder(@CurrentUser('id') userId: string, @Param('orderId') orderId: string) {
    return this.service.acceptOrder(userId, orderId);
  }

  @Roles(UserRole.DRIVER)
  @Get('my-deliveries')
  myDeliveries(@CurrentUser('id') userId: string) {
    return this.service.myDeliveries(userId);
  }
}
