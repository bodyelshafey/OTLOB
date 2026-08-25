import { PrismaService } from '../prisma/prisma.service';

export interface CampaignTarget {
  targetType: string; // ALL | ROLE | USER | STORE_CUSTOMERS
  targetRole?: string | null;
  targetUserId?: string | null;
  targetStoreId?: string | null;
}

// Shared between the immediate "send now" path (notification-campaigns
// module) and the delayed BullMQ job that fires for scheduled campaigns
// (jobs module) — kept as a plain function rather than a service on either
// module so neither module needs to depend on the other just for this.
export async function resolveCampaignTargetUserIds(
  prisma: PrismaService,
  target: CampaignTarget,
): Promise<string[]> {
  switch (target.targetType) {
    case 'ALL': {
      const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
      return users.map((u) => u.id);
    }
    case 'ROLE': {
      if (!target.targetRole) return [];
      const users = await prisma.user.findMany({
        where: { isActive: true, role: target.targetRole as any },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    case 'USER': {
      return target.targetUserId ? [target.targetUserId] : [];
    }
    case 'STORE_CUSTOMERS': {
      if (!target.targetStoreId) return [];
      const orders = await prisma.order.findMany({
        where: { storeId: target.targetStoreId },
        select: { userId: true },
        distinct: ['userId'],
      });
      return orders.map((o) => o.userId);
    }
    default:
      return [];
  }
}
