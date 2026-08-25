import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateBannerDto } from './dto/create-banner.dto';

function liveWindow(now: Date) {
  return {
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

// Banners are admin-managed (only ADMIN/SUPER_ADMIN can create/edit them,
// enforced via @Roles on the controller) but can now optionally be
// attributed to a store via storeId, so the carousel can show whose ad it
// is. That doesn't make them merchant-self-service — a store owner still
// can't create or claim a banner themselves.
@Injectable()
export class BannersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  findActive() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: { isActive: true, ...liveWindow(now) },
      orderBy: { sortOrder: 'asc' },
      include: { store: { select: { id: true, name: true } } },
      // Home-page carousel — a handful of slides, not a growing archive.
      take: 20,
    });
  }

  findAll() {
    return this.prisma.banner.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { store: { select: { id: true, name: true } } },
    });
  }

  async create(dto: CreateBannerDto, userId: string, ipAddress?: string) {
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());
    const banner = await this.prisma.banner.create({ data: { ...dto, sortOrder } as any });
    await this.auditLog.log({
      userId,
      action: 'BANNER_CREATED',
      tableName: 'banners',
      recordId: banner.id,
      metadata: { title: banner.title },
      ipAddress,
    });
    return banner;
  }

  async update(id: string, dto: Partial<CreateBannerDto>, userId: string, ipAddress?: string) {
    await this.findOneOrThrow(id);
    const updated = await this.prisma.banner.update({ where: { id }, data: dto as any });
    await this.auditLog.log({
      userId,
      action: 'BANNER_UPDATED',
      tableName: 'banners',
      recordId: id,
      metadata: { changedFields: Object.keys(dto) },
      ipAddress,
    });
    return updated;
  }

  async remove(id: string, userId: string, ipAddress?: string) {
    const banner = await this.findOneOrThrow(id);
    await this.prisma.banner.delete({ where: { id } });
    await this.auditLog.log({
      userId,
      action: 'BANNER_DELETED',
      tableName: 'banners',
      recordId: id,
      metadata: { title: banner.title },
      ipAddress,
    });
    return banner;
  }

  async toggleActive(id: string) {
    const banner = await this.findOneOrThrow(id);
    return this.prisma.banner.update({ where: { id }, data: { isActive: !banner.isActive } });
  }

  private async findOneOrThrow(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  // New banners go to the end of the order by default, so the admin's
  // up/down reorder controls have something meaningful to move — every
  // banner starting at sortOrder 0 would make those controls no-ops.
  private async nextSortOrder() {
    const last = await this.prisma.banner.findFirst({ orderBy: { sortOrder: 'desc' } });
    return (last?.sortOrder ?? -1) + 1;
  }
}
