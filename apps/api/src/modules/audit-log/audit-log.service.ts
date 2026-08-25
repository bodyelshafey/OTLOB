import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogEntry {
  userId: string;
  action: string; // e.g. 'STORE_SUSPENDED', 'OFFER_DELETED', 'USER_ROLE_CHANGED'
  tableName: string; // e.g. 'stores', 'offers', 'users'
  recordId?: string;
  // Small, structured summary of what changed — never passwords, tokens,
  // or secrets. Callers are responsible for only passing safe fields.
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

// Reuses the existing AuditLog table (was defined but never actually
// written to) — this is the one place anything writes to it, so every
// caller gets the same shape and nothing accidentally logs sensitive data
// differently in different places.
@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  // Fire-and-forget from the caller's perspective is tempting, but audit
  // entries for admin actions matter enough that a silent failure would be
  // worse than a slightly slower response — so this is awaited normally,
  // not queued. It's a single fast insert, not a network call.
  async log(entry: AuditLogEntry) {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        tableName: entry.tableName,
        recordId: entry.recordId,
        metadata: entry.metadata as any,
        ipAddress: entry.ipAddress,
      },
    });
  }

  async findAll(page = 1, limit = 50, filters?: { action?: string; tableName?: string; userId?: string }) {
    const where = {
      ...(filters?.action ? { action: filters.action } : {}),
      ...(filters?.tableName ? { tableName: filters.tableName } : {}),
      ...(filters?.userId ? { userId: filters.userId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
