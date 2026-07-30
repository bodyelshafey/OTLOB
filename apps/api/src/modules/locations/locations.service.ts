import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  zones() {
    return this.prisma.zone.findMany({ include: { districts: true } });
  }

  districts(zoneId?: string) {
    return this.prisma.district.findMany({
      where: zoneId ? { zoneId } : undefined,
      include: { zone: true },
    });
  }
}
