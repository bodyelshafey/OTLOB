import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DriverStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class DriversService {
  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async getMyProfile(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return driver;
  }

  // Update-only, and only for an existing Driver profile — see
  // UsersService.promoteToDriver for the only place a Driver row (and the
  // DRIVER role) actually gets created. No upsert/create here on purpose:
  // that would silently recreate the old self-registration hole for
  // anyone who somehow got a DRIVER role without a profile.
  async updateMyProfile(userId: string, vehicleType?: string, plateNumber?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return this.prisma.driver.update({ where: { userId }, data: { vehicleType, plateNumber } });
  }

  async updateStatus(userId: string, status: DriverStatus) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return this.prisma.driver.update({ where: { userId }, data: { status } });
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    const driver = await this.prisma.driver.update({
      where: { userId },
      data: { currentLat: lat, currentLng: lng },
    });

    const activeOrder = await this.prisma.order.findFirst({
      where: { driverId: driver.id, orderStatus: 'DELIVERING' },
    });
    if (activeOrder) {
      this.realtimeGateway.emitDriverLocation(activeOrder.id, lat, lng);
    }

    return driver;
  }

  // Gated by the REQUESTING driver's own availability (fixed 2026-09-13 —
  // this used to show every READY order to every driver regardless of
  // their DriverStatus, which is exactly the "random broadcast" behavior
  // flagged for this phase). An OFFLINE or already-ON_DELIVERY driver sees
  // nothing here at all — matching acceptOrder's own guard below, so a
  // driver can never even be shown, let alone accept, a second delivery
  // while already on one. ADMIN/SUPER_ADMIN keep the unfiltered oversight
  // view they already had — they have no Driver row to gate by anyway.
  async availableOrders(userId: string, role: string) {
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      if (!driver) throw new NotFoundException('Driver profile not found');
      if (driver.status !== DriverStatus.AVAILABLE) return [];
    }

    return this.prisma.order.findMany({
      where: { orderStatus: 'READY', driverId: null },
      include: { store: true },
    });
  }

  async acceptOrder(userId: string, orderId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    // Same rule as availableOrders above: only an AVAILABLE driver can
    // accept — closes the gap where a driver already ON_DELIVERY (or
    // OFFLINE) could still accept a second delivery by calling this
    // endpoint directly, even though the UI never showed it to them.
    if (driver.status !== DriverStatus.AVAILABLE) {
      throw new ConflictException('You must be available to accept a new delivery');
    }

    // Conditional update, not a blind write: the where clause only matches
    // if the order is still READY and unassigned, so two drivers accepting
    // the same order concurrently can't both "win" — whichever request
    // lands first claims it atomically, and the second gets updateMany's
    // count: 0 and a clear error instead of silently overwriting the first
    // driver's assignment.
    const result = await this.prisma.order.updateMany({
      where: { id: orderId, orderStatus: 'READY', driverId: null },
      data: { driverId: driver.id, orderStatus: 'DELIVERING' },
    });
    if (result.count === 0) {
      throw new ConflictException('This order is no longer available for pickup');
    }
    // A driver can only ever have one active delivery at a time — flip
    // them to ON_DELIVERY in the same action as accepting, not left for
    // the client to remember to call separately.
    await this.prisma.driver.update({ where: { id: driver.id }, data: { status: DriverStatus.ON_DELIVERY } });
    return this.prisma.order.findUnique({ where: { id: orderId } });
  }

  myDeliveries(userId: string) {
    return this.prisma.order.findMany({
      where: { driver: { userId } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
