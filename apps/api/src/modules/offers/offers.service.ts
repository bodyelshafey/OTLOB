import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOfferDto } from './dto/create-offer.dto';

// Slim store fields so offer cards/details can show "who owns this offer"
// without pulling the whole store record.
const STORE_SUMMARY = {
  select: { id: true, name: true, image: true, deliveryTime: true, rating: true, isOpen: true },
};

const PRIVILEGED = ['ADMIN', 'SUPER_ADMIN'];

@Injectable()
export class OffersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private notifications: NotificationsService,
  ) {}

  // homeFeed=true is the homepage "Today's Offers" section specifically —
  // only offers a store owner marked isFeaturedHome AND an admin approved
  // are eligible there. Without it (store page / general offer listing),
  // every active normal offer shows, same as before this feature existed.
  findAll(storeId?: string, homeFeed?: boolean) {
    return this.prisma.offer.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        ...(storeId ? { storeId } : {}),
        ...(homeFeed ? { isFeaturedHome: true, approvalStatus: 'APPROVED' } : {}),
      },
      orderBy: homeFeed ? [{ displayOrder: 'asc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
      include: { store: STORE_SUMMARY },
      // "Today's offers" is a curated home-page feed, not a paged listing —
      // cap it instead of returning every active offer platform-wide as it grows.
      take: storeId ? undefined : 30,
    });
  }

  // Management list — includes inactive offers too, so an owner/admin can
  // actually see and re-toggle something they turned off. The public
  // findAll() above deliberately excludes those (it's the storefront feed).
  findManaged(userId: string, role: string, storeId?: string) {
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(role);
    return this.prisma.offer.findMany({
      where: {
        isDeleted: false,
        ...(isPrivileged ? (storeId ? { storeId } : {}) : { store: { ownerId: userId } }),
      },
      orderBy: { createdAt: 'desc' },
      include: { store: STORE_SUMMARY },
      // Same reasoning as findAll — an admin viewing "all offers, all
      // stores" with no filter shouldn't pull an unbounded table scan.
      take: storeId ? undefined : 200,
    });
  }

  // Admin review queue — special/featured offers awaiting a decision.
  findPending(storeId?: string) {
    return this.prisma.offer.findMany({
      where: { isDeleted: false, isFeaturedHome: true, approvalStatus: 'PENDING', ...(storeId ? { storeId } : {}) },
      orderBy: { createdAt: 'asc' },
      include: { store: STORE_SUMMARY },
      take: 200,
    });
  }

  async findOne(id: string) {
    const offer = await this.prisma.offer.findFirst({
      where: { id, isDeleted: false },
      include: { store: STORE_SUMMARY },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  async create(userId: string, role: string, dto: CreateOfferDto) {
    await this.assertStoreAccess(dto.storeId, userId, role);
    const isPrivileged = PRIVILEGED.includes(role);
    // Requesting homepage placement always starts PENDING for a merchant —
    // an admin can create/approve their own in one step. approvalStatus is
    // never accepted from the client (it isn't in the DTO at all).
    const approvalStatus = dto.isFeaturedHome && !isPrivileged ? 'PENDING' : 'APPROVED';
    const offer = await this.prisma.offer.create({ data: { ...dto, approvalStatus } as any });
    if (approvalStatus === 'PENDING') {
      await this.notifications.notifyAdmins(
        'عرض مميز بانتظار المراجعة',
        'Featured offer pending review',
        `تم تقديم عرض "${offer.titleAr}" للمراجعة قبل ظهوره في الصفحة الرئيسية.`,
        `A featured offer "${offer.titleAr}" was submitted for review.`,
        'OFFER_PENDING_REVIEW',
        { offerId: offer.id, storeId: offer.storeId },
      );
    }
    return offer;
  }

  async update(id: string, userId: string, role: string, dto: Partial<CreateOfferDto>) {
    const offer = await this.assertOfferOwnership(id, userId, role);
    const isPrivileged = PRIVILEGED.includes(role);
    // storeId is not editable via update — an offer stays attached to the
    // store it was created for.
    const { storeId: _ignored, ...rest } = dto;

    // Flipping isFeaturedHome on (or editing content of an already-pending
    // special offer) re-opens review for a merchant — they can't silently
    // keep a stale APPROVED status while changing what's being shown.
    let approvalStatus: 'PENDING' | 'APPROVED' | undefined;
    if (!isPrivileged && rest.isFeaturedHome === true && !offer.isFeaturedHome) {
      approvalStatus = 'PENDING';
    } else if (!isPrivileged && rest.isFeaturedHome === false) {
      approvalStatus = 'APPROVED'; // no longer requesting placement, review is moot
    }

    const updated = await this.prisma.offer.update({
      where: { id: offer.id },
      data: { ...rest, ...(approvalStatus ? { approvalStatus } : {}) } as any,
    });
    if (approvalStatus === 'PENDING') {
      await this.notifications.notifyAdmins(
        'عرض مميز بانتظار المراجعة',
        'Featured offer pending review',
        `تم تقديم عرض "${updated.titleAr}" للمراجعة قبل ظهوره في الصفحة الرئيسية.`,
        `A featured offer "${updated.titleAr}" was submitted for review.`,
        'OFFER_PENDING_REVIEW',
        { offerId: updated.id, storeId: updated.storeId },
      );
    }
    return updated;
  }

  async remove(id: string, userId: string, role: string, ipAddress?: string) {
    const offer = await this.assertOfferOwnership(id, userId, role);
    const removed = await this.prisma.offer.update({
      where: { id: offer.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    if (PRIVILEGED.includes(role)) {
      await this.auditLog.log({
        userId,
        action: 'OFFER_DELETED',
        tableName: 'offers',
        recordId: id,
        metadata: { title: offer.titleAr, storeId: offer.storeId },
        ipAddress,
      });
    }
    return removed;
  }

  async toggleActive(id: string, userId: string, role: string) {
    const offer = await this.assertOfferOwnership(id, userId, role);
    return this.prisma.offer.update({ where: { id: offer.id }, data: { isActive: !offer.isActive } });
  }

  async approve(id: string, adminId: string, role: string) {
    this.assertPrivileged(role);
    const offer = await this.findOrThrowAny(id);
    const updated = await this.prisma.offer.update({
      where: { id: offer.id },
      data: { approvalStatus: 'APPROVED', reviewedById: adminId, reviewedAt: new Date(), rejectionReason: null },
    });
    await this.notifyStoreOwner(
      offer.storeId,
      'تمت الموافقة على عرضك المميز',
      'Your featured offer was approved',
      `تمت الموافقة على عرض "${offer.titleAr}" وأصبح ظاهرًا في الصفحة الرئيسية.`,
      `Your featured offer "${offer.titleAr}" was approved and is now live on the homepage.`,
      'OFFER_APPROVED',
      { offerId: offer.id },
    );
    return updated;
  }

  async reject(id: string, adminId: string, role: string, reason?: string) {
    this.assertPrivileged(role);
    const offer = await this.findOrThrowAny(id);
    const updated = await this.prisma.offer.update({
      where: { id: offer.id },
      data: {
        approvalStatus: 'REJECTED',
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason ?? null,
      },
    });
    await this.notifyStoreOwner(
      offer.storeId,
      'تم رفض عرضك المميز',
      'Your featured offer was rejected',
      reason ? `تم رفض عرض "${offer.titleAr}". السبب: ${reason}` : `تم رفض عرض "${offer.titleAr}".`,
      reason ? `Your featured offer "${offer.titleAr}" was rejected. Reason: ${reason}` : `Your featured offer "${offer.titleAr}" was rejected.`,
      'OFFER_REJECTED',
      { offerId: offer.id, reason },
    );
    return updated;
  }

  private async notifyStoreOwner(
    storeId: string,
    titleAr: string,
    titleEn: string,
    bodyAr: string,
    bodyEn: string,
    type: string,
    data: Record<string, unknown>,
  ) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { ownerId: true } });
    if (!store) return;
    await this.notifications.create(store.ownerId, titleAr, titleEn, bodyAr, bodyEn, type, data as any);
  }

  private assertPrivileged(role: string) {
    if (!PRIVILEGED.includes(role)) throw new ForbiddenException('Only an admin can perform this action');
  }

  private async findOrThrowAny(id: string) {
    const offer = await this.prisma.offer.findFirst({ where: { id, isDeleted: false } });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  // Same ownership rule used across the app (see ProductsService): a
  // privileged role manages anything, a STORE_OWNER manages their own
  // store (Store.ownerId), and anyone else needs an actual StoreMember row
  // for that store. My first pass at this only checked Store.ownerId,
  // which silently 403'd any store accessed through a StoreMember
  // membership instead of literal ownership — that's what was making
  // "save" appear to do nothing.
  private async assertStoreAccess(storeId: string, userId: string, userRole: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    if (['ADMIN', 'SUPER_ADMIN'].includes(userRole)) return store;
    if (store.ownerId === userId) return store;
    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!membership) throw new ForbiddenException('You do not have access to this store');
    return store;
  }

  private async assertOfferOwnership(id: string, userId: string, userRole: string) {
    const offer = await this.findOrThrowAny(id);
    await this.assertStoreAccess(offer.storeId, userId, userRole);
    return offer;
  }
}
