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

  // Hydrates the dashboard's status toggle with the REAL current state on
  // load (fixed 2026-09-13 — the web dashboard previously just hardcoded
  // `OFFLINE` in local state on every page load/refresh regardless of what
  // the driver's actual status was server-side).
  @Roles(UserRole.DRIVER)
  @Get('me')
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.service.getMyProfile(userId);
  }

  // NOTE: there used to be a POST /drivers/register here that let ANY
  // authenticated user create their own Driver profile — no @Roles guard
  // at all. That was a real security gap (flagged 2026-09-12): a normal
  // USER should never be able to become a driver by calling an endpoint.
  // The only way to become a DRIVER now is
  // PATCH /users/:id/promote-to-driver (ADMIN/SUPER_ADMIN only) — see
  // UsersService.promoteToDriver. This route is now update-only, and only
  // for someone who is ALREADY a driver (their own profile, not anyone
  // else's — enforced by using the caller's own userId, never a body/param
  // id).
  @Roles(UserRole.DRIVER)
  @Patch('me')
  updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() body: { vehicleType?: string; plateNumber?: string },
  ) {
    return this.service.updateMyProfile(userId, body.vehicleType, body.plateNumber);
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
  availableOrders(@CurrentUser('id') userId: string, @CurrentUser('role') role: string) {
    return this.service.availableOrders(userId, role);
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
