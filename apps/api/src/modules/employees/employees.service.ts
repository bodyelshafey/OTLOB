import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StoreMemberRole, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCashierDto } from './dto/create-cashier.dto';
import { ConflictWithCodeException } from '../../common/exceptions/app.exceptions';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  // Creates a BRAND NEW account for the cashier directly — replaces the
  // old flow where the owner had to ask the cashier to self-register a
  // normal account first and hand over their user ID (a real UX and
  // security smell: it meant a "cashier" was, for a window of time, just
  // a normal USER-role account with no store affiliation yet, created
  // with no owner oversight at all). Cashiers never self-register now —
  // this is the ONLY way a cashier account is created. `phoneVerified` is
  // set true immediately (no phone exists to verify — see login()'s
  // username fallback and the schema.prisma comment on User.username);
  // trust here comes from the store owner's authority, not an OTP.
  async createCashier(storeId: string, requesterId: string, dto: CreateCashierDto) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    if (store.ownerId !== requesterId) throw new ForbiddenException('Only the store owner can add cashiers');

    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictWithCodeException('USERNAME_ALREADY_EXISTS', 'This username is already in use.');
    }

    const passwordHash = await argon2.hash(dto.password);

    let member;
    try {
      member = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: dto.fullName,
            username: dto.username,
            passwordHash,
            role: UserRole.EMPLOYEE,
            phoneVerified: true,
          },
        });
        return tx.storeMember.create({
          data: { storeId, userId: user.id, role: StoreMemberRole.CASHIER },
          include: { user: { select: { id: true, fullName: true, username: true } } },
        });
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictWithCodeException('USERNAME_ALREADY_EXISTS', 'This username is already in use.');
      }
      throw err;
    }

    return member;
  }

  async addMember(storeId: string, requesterId: string, userId: string, role: StoreMemberRole) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    if (store.ownerId !== requesterId) throw new ForbiddenException('Only the store owner can add employees');

    return this.prisma.storeMember.upsert({
      where: { storeId_userId: { storeId, userId } },
      update: { role },
      create: { storeId, userId, role },
    });
  }

  // Previously any STORE_OWNER could list ANY store's staff roster (names,
  // emails, phone numbers) just by knowing/guessing a storeId — the
  // @Roles(STORE_OWNER, ...) on the controller only checked the caller had
  // *a* store, never that it was *this* store.
  async listMembers(storeId: string, requesterId: string, requesterRole: string) {
    const isPrivileged = ['ADMIN', 'SUPER_ADMIN'].includes(requesterRole);
    if (!isPrivileged) {
      const store = await this.prisma.store.findUnique({ where: { id: storeId } });
      if (!store) throw new NotFoundException('Store not found');
      if (store.ownerId !== requesterId) {
        const membership = await this.prisma.storeMember.findUnique({
          where: { storeId_userId: { storeId, userId: requesterId } },
        });
        if (!membership) throw new ForbiddenException('You do not have access to this store');
      }
    }
    return this.prisma.storeMember.findMany({
      where: { storeId },
      include: { user: { select: { fullName: true, email: true, phone: true, username: true } } },
    });
  }

  async removeMember(storeId: string, requesterId: string, memberId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    if (store.ownerId !== requesterId) throw new ForbiddenException('Only the store owner can remove employees');
    await this.prisma.storeMember.delete({ where: { id: memberId } });
    return { message: 'Employee removed' };
  }
}
