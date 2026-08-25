import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StoreMemberRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

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
      include: { user: { select: { fullName: true, email: true, phone: true } } },
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
