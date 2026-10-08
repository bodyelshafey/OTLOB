import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { QueryStoreDto } from './dto/query-store.dto';
import { WorkingHourEntryDto } from './dto/set-working-hours.dto';
import { isStoreOpenNow } from '../../common/utils/store-hours.util';

@Injectable()
export class StoresService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async findAll(query: QueryStoreDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;

    const where = {
      isDeleted: false,
      ...(query.storeTypeId ? { storeTypeId: query.storeTypeId } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { rating: 'desc' },
        include: { storeType: true },
      }),
      this.prisma.store.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // Extended 2026-09-13 (Phase 6) so store STAFF (cashiers/managers — a
  // StoreMember row, not the owner) can also discover "their" store
  // through this same endpoint, e.g. to land on the cashier dashboard.
  // Ownership and membership are mutually exclusive in practice (an owner
  // is never also a StoreMember row for their own store), so the OR here
  // never double-counts.
  findMine(userId: string) {
    return this.prisma.store.findMany({
      where: {
        isDeleted: false,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: { storeType: true },
    });
  }

  async findOne(id: string) {
    const store = await this.prisma.store.findFirst({
      where: { id, isDeleted: false },
      include: { storeType: true, categories: true, workingHours: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    // Computed, not stored — combines the manual isOpen toggle with the
    // configured weekly schedule (see store-hours.util). A store that never
    // set working hours is only gated by isOpen, same as before this feature.
    return { ...store, isOpenNow: isStoreOpenNow(store.isOpen, store.workingHours) };
  }

  create(ownerId: string, dto: CreateStoreDto) {
    return this.prisma.store.create({
      data: { ...dto, ownerId },
    });
  }

  async update(id: string, userId: string, userRole: string, dto: Partial<CreateStoreDto>, ipAddress?: string) {
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    const store = await this.assertOwnership(id, userId, userRole);
    const updated = await this.prisma.store.update({ where: { id }, data: dto });
    // Only an admin editing a store they don't own is a "sensitive
    // administrative operation" worth an audit trail — a merchant editing
    // their own store is routine self-service, not something to log here.
    if (isPrivileged && store.ownerId !== userId) {
      await this.auditLog.log({
        userId,
        action: 'STORE_UPDATED',
        tableName: 'stores',
        recordId: id,
        metadata: { changedFields: Object.keys(dto) },
        ipAddress,
      });
    }
    return updated;
  }

  async remove(id: string, userId: string, userRole: string, ipAddress?: string) {
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    const store = await this.assertOwnership(id, userId, userRole);
    const updated = await this.prisma.store.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    if (isPrivileged && store.ownerId !== userId) {
      await this.auditLog.log({
        userId,
        action: 'STORE_SUSPENDED',
        tableName: 'stores',
        recordId: id,
        metadata: { storeName: store.name },
        ipAddress,
      });
    }
    return updated;
  }

  async toggleOpen(id: string, userId: string, userRole: string) {
    const store = await this.assertOwnership(id, userId, userRole);
    return this.prisma.store.update({ where: { id }, data: { isOpen: !store.isOpen } });
  }

  // Admin-only (enforced at the controller) — there was previously no way
  // to actually set a store's commission rate at all, only read whatever
  // the schema default (10%) produced. StoreSettings is upserted since a
  // store may not have a settings row yet.
  async setCommission(id: string, percentage: number, userId: string, ipAddress?: string) {
    const store = await this.prisma.store.findUnique({ where: { id }, include: { settings: true } });
    if (!store) throw new NotFoundException('Store not found');
    const previous = store.settings?.commissionPercentage ?? 10;

    const settings = await this.prisma.storeSettings.upsert({
      where: { storeId: id },
      update: { commissionPercentage: percentage },
      create: { storeId: id, commissionPercentage: percentage },
    });

    await this.auditLog.log({
      userId,
      action: 'STORE_COMMISSION_CHANGED',
      tableName: 'stores',
      recordId: id,
      metadata: { storeName: store.name, fromPercentage: Number(previous), toPercentage: percentage },
      ipAddress,
    });

    return settings;
  }

  getWorkingHours(storeId: string) {
    return this.prisma.workingHour.findMany({ where: { storeId }, orderBy: { dayOfWeek: 'asc' } });
  }

  // Replace-all semantics: the dashboard always sends the full week, so we
  // just delete and recreate rather than diffing individual days — simpler
  // and there's no history/audit value in keeping stale per-day rows.
  async setWorkingHours(storeId: string, userId: string, userRole: string, days: WorkingHourEntryDto[]) {
    await this.assertOwnership(storeId, userId, userRole);
    return this.prisma.$transaction(async (tx) => {
      await tx.workingHour.deleteMany({ where: { storeId } });
      await tx.workingHour.createMany({
        data: days.map((d) => ({
          storeId,
          dayOfWeek: d.dayOfWeek,
          openTime: d.openTime,
          closeTime: d.closeTime,
          isClosed: d.isClosed,
        })),
      });
      return tx.workingHour.findMany({ where: { storeId }, orderBy: { dayOfWeek: 'asc' } });
    });
  }

  private async assertOwnership(id: string, userId: string, userRole: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    if (!isPrivileged && store.ownerId !== userId) {
      throw new ForbiddenException('You do not own this store');
    }
    return store;
  }
}
