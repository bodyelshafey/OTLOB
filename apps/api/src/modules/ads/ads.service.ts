import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAdDto } from './dto/create-ad.dto';

// Shared "currently live" filter: active, and (if scheduling is set) inside
// the startsAt/endsAt window. Both fields are optional, so an ad with no
// schedule is always eligible once isActive is true.
function liveWindow(now: Date) {
  return {
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

// Stored as a plain string in the existing generic Setting key/value table
// (no new table needed) so it's admin-configurable without a code change.
const AD_MONTHLY_LIMIT_SETTING_KEY = 'ad_monthly_limit_default';
// Used only if no admin has configured a global default yet — keeps quota
// enforcement meaningful from day one instead of silently unlimited.
const FALLBACK_MONTHLY_AD_LIMIT = 5;

function monthWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { gte: start, lt: end };
}

@Injectable()
export class AdsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Public carousel feed — only what's actually approved AND live right now.
  // A merchant-created ad can be isActive=true and still not show up here
  // until an admin approves it.
  findActive(storeId?: string) {
    const now = new Date();
    return this.prisma.ad.findMany({
      where: {
        isActive: true,
        approvalStatus: 'APPROVED',
        ...liveWindow(now),
        ...(storeId ? { storeId } : {}),
      },
      orderBy: { sortOrder: 'asc' },
      include: { store: { select: { id: true, name: true, image: true } } },
      // A carousel only ever shows a handful of slides — cap the feed so it
      // doesn't grow unbounded as more ads accumulate platform-wide.
      take: storeId ? undefined : 20,
    });
  }

  // Management list — everything, regardless of approval/schedule/active
  // state, so owners/admins can see and act on ads that aren't live yet.
  findAll(userId: string, role: string, storeId?: string) {
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    return this.prisma.ad.findMany({
      where: isPrivileged ? (storeId ? { storeId } : {}) : { store: { ownerId: userId } },
      orderBy: { sortOrder: 'asc' },
      include: { store: { select: { id: true, name: true, image: true } } },
      take: storeId ? undefined : 200,
    });
  }

  // Admin review queue.
  findPending(storeId?: string) {
    return this.prisma.ad.findMany({
      where: { approvalStatus: 'PENDING', ...(storeId ? { storeId } : {}) },
      orderBy: { createdAt: 'asc' },
      include: { store: { select: { id: true, name: true, image: true } } },
      take: 200,
    });
  }

  // Store-owner dashboard: this month's quota + a breakdown by status.
  async getQuota(userId: string, role: string, storeId: string) {
    const store = await this.assertStoreAccess(storeId, userId, role);
    const limit = await this.getEffectiveMonthlyLimit(store.id, store.monthlyAdLimitOverride);
    const window = monthWindow(new Date());
    const [used, pending, approved, rejected] = await Promise.all([
      this.prisma.ad.count({ where: { storeId, createdAt: window } }),
      this.prisma.ad.count({ where: { storeId, createdAt: window, approvalStatus: 'PENDING' } }),
      this.prisma.ad.count({ where: { storeId, createdAt: window, approvalStatus: 'APPROVED' } }),
      this.prisma.ad.count({ where: { storeId, createdAt: window, approvalStatus: 'REJECTED' } }),
    ]);
    return { limit, used, remaining: Math.max(limit - used, 0), pending, approved, rejected };
  }

  async create(userId: string, role: string, dto: CreateAdDto) {
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(role);

    if (isPrivileged) {
      if (dto.storeId) await this.assertStoreExists(dto.storeId);
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());
      // Platform-wide or admin-created ads skip review — an admin approving
      // their own ad isn't a meaningful check the way it is for a merchant.
      return this.prisma.ad.create({ data: { ...dto, sortOrder, approvalStatus: 'APPROVED' } as any });
    }

    // A merchant can only ever create an ad for their own store — never a
    // platform-wide ad (storeId omitted) and never another store's.
    if (!dto.storeId) throw new ForbiddenException('storeId is required for merchant-created ads');
    const store = await this.assertStoreAccess(dto.storeId, userId, role);

    // Count-then-create inside a single Serializable transaction so two
    // concurrent requests can't both observe "under quota" and both insert
    // — Postgres aborts the loser with a serialization failure instead of
    // silently letting the quota be exceeded.
    try {
      const ad = await this.prisma.$transaction(
        async (tx) => {
          const limit = await this.getEffectiveMonthlyLimit(store.id, store.monthlyAdLimitOverride, tx);
          const used = await tx.ad.count({ where: { storeId: store.id, createdAt: monthWindow(new Date()) } });
          if (used >= limit) {
            throw new BadRequestException(
              `Monthly advertisement limit reached (${limit}). Try again next month or ask an admin to raise your limit.`,
            );
          }
          const sortOrder = dto.sortOrder ?? (await this.nextSortOrderTx(tx));
          return tx.ad.create({ data: { ...dto, sortOrder, approvalStatus: 'PENDING' } as any });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.notifications.notifyAdmins(
        'إعلان بانتظار المراجعة',
        'Advertisement pending review',
        `تم تقديم إعلان جديد من متجر "${store.name}" للمراجعة.`,
        `A new advertisement from store "${store.name}" was submitted for review.`,
        'AD_PENDING_REVIEW',
        { adId: ad.id, storeId: store.id },
      );
      return ad;
    } catch (err: any) {
      // Postgres serialization failure from the concurrent-request race
      // above — safe to treat the same as "hit the limit right now",
      // rather than surfacing a raw DB error to the client.
      if (err?.code === 'P2034') {
        throw new BadRequestException('Please try again — another request was being processed at the same time.');
      }
      throw err;
    }
  }

  async update(id: string, userId: string, role: string, dto: Partial<CreateAdDto>) {
    const ad = await this.assertAdOwnership(id, userId, role);
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    // A merchant editing their own ad can't reassign it to another store,
    // detach it into a platform-wide ad, or touch the approval fields
    // directly — that's approve()/reject() only.
    const { storeId: _ignored, ...rest } = dto;
    const data = isPrivileged ? dto : rest;
    return this.prisma.ad.update({ where: { id: ad.id }, data: data as any });
  }

  async remove(id: string, userId: string, role: string) {
    const ad = await this.assertAdOwnership(id, userId, role);
    return this.prisma.ad.delete({ where: { id: ad.id } });
  }

  async toggleActive(id: string, userId: string, role: string) {
    const ad = await this.assertAdOwnership(id, userId, role);
    return this.prisma.ad.update({ where: { id: ad.id }, data: { isActive: !ad.isActive } });
  }

  async approve(id: string, adminId: string, role: string) {
    this.assertPrivileged(role);
    const ad = await this.findOrThrow(id);
    const updated = await this.prisma.ad.update({
      where: { id: ad.id },
      data: { approvalStatus: 'APPROVED', reviewedById: adminId, reviewedAt: new Date(), rejectionReason: null },
    });
    if (ad.storeId) {
      await this.notifyStoreOwner(
        ad.storeId,
        'تمت الموافقة على إعلانك',
        'Your advertisement was approved',
        'تمت الموافقة على إعلانك وأصبح ظاهرًا في الصفحة الرئيسية.',
        'Your advertisement was approved and is now live on the homepage.',
        'AD_APPROVED',
        { adId: ad.id },
      );
    }
    return updated;
  }

  async reject(id: string, adminId: string, role: string, reason?: string) {
    this.assertPrivileged(role);
    const ad = await this.findOrThrow(id);
    const updated = await this.prisma.ad.update({
      where: { id: ad.id },
      data: {
        approvalStatus: 'REJECTED',
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason ?? null,
      },
    });
    if (ad.storeId) {
      await this.notifyStoreOwner(
        ad.storeId,
        'تم رفض إعلانك',
        'Your advertisement was rejected',
        reason ? `تم رفض إعلانك. السبب: ${reason}` : 'تم رفض إعلانك.',
        reason ? `Your advertisement was rejected. Reason: ${reason}` : 'Your advertisement was rejected.',
        'AD_REJECTED',
        reason ? { adId: ad.id, reason } : { adId: ad.id },
      );
    }
    return updated;
  }

  private async notifyStoreOwner(
    storeId: string,
    titleAr: string,
    titleEn: string,
    bodyAr: string,
    bodyEn: string,
    type: string,
    data: Prisma.InputJsonObject,
  ) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
    if (!store) return;
    await this.notifications.create(store.ownerId, titleAr, titleEn, bodyAr, bodyEn, type, data);
  }

  // Global default, admin-configurable.
  async getGlobalMonthlyLimit(): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key: AD_MONTHLY_LIMIT_SETTING_KEY } });
    const parsed = row ? Number(row.value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_MONTHLY_AD_LIMIT;
  }

  async setGlobalMonthlyLimit(role: string, value: number) {
    this.assertPrivileged(role);
    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException('value must be a positive integer');
    }
    await this.prisma.setting.upsert({
      where: { key: AD_MONTHLY_LIMIT_SETTING_KEY },
      create: { key: AD_MONTHLY_LIMIT_SETTING_KEY, value: String(value) },
      update: { value: String(value) },
    });
    return { key: AD_MONTHLY_LIMIT_SETTING_KEY, value };
  }

  private async getEffectiveMonthlyLimit(
    storeId: string,
    override: number | null,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    if (override != null) return override;
    const row = await tx.setting.findUnique({ where: { key: AD_MONTHLY_LIMIT_SETTING_KEY } });
    const parsed = row ? Number(row.value) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_MONTHLY_AD_LIMIT;
  }

  private assertPrivileged(role: string) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      throw new ForbiddenException('Only an admin can perform this action');
    }
  }

  private async findOrThrow(id: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException('Ad not found');
    return ad;
  }

  private async assertStoreExists(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  // Same ownership rule used across the app (see ProductsService): a
  // privileged role manages anything, a STORE_OWNER manages their own
  // store (Store.ownerId), and anyone else needs an actual StoreMember row
  // for that store. My first pass at this only checked Store.ownerId,
  // which silently 403'd any store accessed through a StoreMember
  // membership instead of literal ownership — that's what was making
  // "save" appear to do nothing.
  private async assertStoreAccess(storeId: string, userId: string, userRole: string) {
    const store = await this.assertStoreExists(storeId);
    if (['ADMIN', 'SUPER_ADMIN'].includes(userRole)) return store;
    if (store.ownerId === userId) return store;
    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!membership) throw new ForbiddenException('You do not have access to this store');
    return store;
  }

  private async assertAdOwnership(id: string, userId: string, userRole: string) {
    const ad = await this.findOrThrow(id);
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
    if (!isPrivileged) {
      if (!ad.storeId) throw new ForbiddenException('Only an admin can manage a platform-wide ad');
      await this.assertStoreAccess(ad.storeId, userId, userRole);
    }
    return ad;
  }

  private async nextSortOrder() {
    const last = await this.prisma.ad.findFirst({ orderBy: { sortOrder: 'desc' } });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async nextSortOrderTx(tx: Prisma.TransactionClient) {
    const last = await tx.ad.findFirst({ orderBy: { sortOrder: 'desc' } });
    return (last?.sortOrder ?? -1) + 1;
  }
}
