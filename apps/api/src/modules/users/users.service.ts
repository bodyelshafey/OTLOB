import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { PromoteToDriverDto } from './dto/promote-to-driver.dto';

// DRIVER is deliberately NOT assignable through the generic changeRole
// endpoint below — promoting to DRIVER also needs a Driver profile row
// (vehicle info, approval flag), so it goes through the dedicated
// promoteToDriver() below instead. Setting role=DRIVER without a Driver
// row would break every @Roles(DRIVER) endpoint that also does
// `prisma.driver.findUnique({ where: { userId } })` (404s with "Driver
// profile not found").
const ASSIGNABLE_ROLES = ['USER', 'STORE_OWNER', 'ADMIN'];

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

  // Server-side search across name/email/phone (Phase 3/22 admin users UI,
  // 2026-09-13) — never download the full user list to the browser and
  // filter client-side; that doesn't scale and leaks every user's data to
  // the admin's browser memory regardless of what they're looking for.
  async findAll(page = 1, limit = 20, search?: string) {
    const where = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : undefined;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
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

  // The ONLY way an account becomes a DRIVER (see §9/§22 of the production
  // hardening pass, 2026-09-12): a normal user can no longer self-register
  // as a driver — POST /drivers/register was removed entirely from
  // DriversController for exactly this reason. This is ADMIN/SUPER_ADMIN
  // only (enforced by @Roles on the controller route), creates the Driver
  // profile in the same operation (so every @Roles(DRIVER) endpoint that
  // looks up a Driver row by userId works immediately), and is audited.
  // isApproved is set true immediately — this admin action IS the
  // approval step; there's no separate pending-driver review queue yet
  // (tracked as a known limitation in the README, not implemented here).
  async promoteToDriver(id: string, dto: PromoteToDriverDto, actingUserId: string, ipAddress?: string) {
    const target = await this.prisma.user.findUnique({ where: { id }, include: { driver: true } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') {
      throw new BadRequestException('Cannot promote an admin account to driver');
    }
    if (target.role === 'DRIVER' && target.driver) {
      throw new ConflictException('This user is already a driver');
    }

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { role: 'DRIVER' } }),
      this.prisma.driver.upsert({
        where: { userId: id },
        update: { vehicleType: dto.vehicleType, plateNumber: dto.plateNumber, isApproved: true },
        create: { userId: id, vehicleType: dto.vehicleType, plateNumber: dto.plateNumber, isApproved: true },
      }),
    ]);

    await this.auditLog.log({
      userId: actingUserId,
      action: 'USER_PROMOTED_TO_DRIVER',
      tableName: 'users',
      recordId: id,
      metadata: { targetEmail: target.email, vehicleType: dto.vehicleType, plateNumber: dto.plateNumber },
      ipAddress,
    });

    return this.sanitize(updatedUser);
  }
}
