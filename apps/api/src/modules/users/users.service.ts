import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpdateUserDto } from './dto/update-user.dto';

const ASSIGNABLE_ROLES = ['USER', 'STORE_OWNER', 'DRIVER', 'ADMIN'];

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  private sanitize(user: any) {
    if (!user) return user;
    const { passwordHash, refreshToken, ...safe } = user;
    return safe;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    return this.sanitize(user);
  }

  async findAll(page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return { items: items.map((u) => this.sanitize(u)), total, page, limit };
  }

  // Disabling, not deleting — the schema has no soft-delete flag on User
  // (unlike Store/Product/Offer), and a hard delete would cascade into
  // orders/reviews/addresses in ways that aren't obviously desirable.
  // isActive is the existing mechanism (already checked at login).
  async toggleActive(id: string, actingUserId: string, ipAddress?: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !target.isActive },
    });
    await this.auditLog.log({
      userId: actingUserId,
      action: updated.isActive ? 'USER_ENABLED' : 'USER_DISABLED',
      tableName: 'users',
      recordId: id,
      metadata: { targetEmail: target.email },
      ipAddress,
    });
    return this.sanitize(updated);
  }

  async changeRole(id: string, newRole: string, actingUserId: string, ipAddress?: string) {
    if (!ASSIGNABLE_ROLES.includes(newRole)) {
      throw new BadRequestException(`role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`);
    }
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'SUPER_ADMIN') {
      // Not even another SUPER_ADMIN can demote a super admin through this
      // endpoint — that's a break-glass operation, not a routine one.
      throw new BadRequestException('Cannot change the role of a super admin through this endpoint');
    }
    const updated = await this.prisma.user.update({ where: { id }, data: { role: newRole as any } });
    await this.auditLog.log({
      userId: actingUserId,
      action: 'USER_ROLE_CHANGED',
      tableName: 'users',
      recordId: id,
      metadata: { targetEmail: target.email, fromRole: target.role, toRole: newRole },
      ipAddress,
    });
    return this.sanitize(updated);
  }
}
