import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

const PRIVILEGED = ['ADMIN', 'SUPER_ADMIN'];

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Public storefront listing — only active categories, in the order the
  // owner/admin configured. Management screens use findAllManaged instead,
  // which also returns inactive ones.
  findAll(storeTypeId?: string, storeId?: string) {
    return this.prisma.category.findMany({
      where: {
        isActive: true,
        ...(storeTypeId ? { storeTypeId } : {}),
        ...(storeId ? { storeId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
  }

  findAllManaged(userId: string, role: string, storeId?: string) {
    const isPrivileged = PRIVILEGED.includes(role);
    return this.prisma.category.findMany({
      where: isPrivileged ? (storeId ? { storeId } : {}) : { store: { ownerId: userId } },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.category.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Category not found');
    return item;
  }

  // A STORE_OWNER can only create a category for a store they own — this
  // used to accept any storeId (or none, meaning a platform-wide category)
  // from any STORE_OWNER with no check at all.
  async create(userId: string, role: string, dto: CreateCategoryDto) {
    const isPrivileged = PRIVILEGED.includes(role);
    if (dto.storeId) {
      await this.assertStoreOwnership(dto.storeId, userId, isPrivileged);
    } else if (!isPrivileged) {
      // No storeId = a platform-wide category (tied only to a StoreType) —
      // that's an admin-level concept, not something a merchant creates.
      throw new ForbiddenException('Only an admin can create a store-type-wide category');
    }
    return this.prisma.category.create({ data: dto });
  }

  async update(id: string, userId: string, role: string, dto: Partial<CreateCategoryDto>) {
    const category = await this.findOne(id);
    const isPrivileged = PRIVILEGED.includes(role);
    if (category.storeId) {
      await this.assertStoreOwnership(category.storeId, userId, isPrivileged);
    } else if (!isPrivileged) {
      throw new ForbiddenException('Only an admin can edit a store-type-wide category');
    }
    // A merchant can't move their category onto another store, or turn it
    // into (or out of) a platform-wide one.
    const { storeId: _ignored, ...rest } = dto;
    return this.prisma.category.update({ where: { id }, data: isPrivileged ? dto : rest });
  }

  async remove(id: string, userId: string, role: string) {
    const category = await this.findOne(id);
    const isPrivileged = PRIVILEGED.includes(role);
    if (category.storeId) {
      await this.assertStoreOwnership(category.storeId, userId, isPrivileged);
    } else if (!isPrivileged) {
      throw new ForbiddenException('Only an admin can delete a store-type-wide category');
    }
    return this.prisma.category.delete({ where: { id } });
  }

  // Same ownership rule used across the app (see ProductsService/OffersService):
  // a privileged role manages anything, a STORE_OWNER manages their own store
  // (Store.ownerId), and anyone else needs an actual StoreMember row.
  private async assertStoreOwnership(storeId: string, userId: string, isPrivileged: boolean) {
    if (isPrivileged) return;
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');
    if (store.ownerId === userId) return;
    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
    });
    if (!membership) throw new ForbiddenException('You do not have access to this store');
  }
}
