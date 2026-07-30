import { Injectable, NotFoundException } from '@nestjs/common';
import { DriverStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class DriversService {
  constructor(
    private prisma: PrismaService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async registerAsDriver(userId: string, vehicleType?: string, plateNumber?: string) {
    return this.prisma.driver.upsert({
      where: { userId },
      update: { vehicleType, plateNumber },
      create: { userId, vehicleType, plateNumber },
    });
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

  availableOrders() {
    return this.prisma.order.findMany({
      where: { orderStatus: 'READY', driverId: null },
      include: { store: true },
    });
  }

  async acceptOrder(userId: string, orderId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
    return this.prisma.order.update({
      where: { id: orderId },
      data: { driverId: driver.id, orderStatus: 'DELIVERING' },
    });
  }

  myDeliveries(userId: string) {
    return this.prisma.order.findMany({
      where: { driver: { userId } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
