import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { ConflictWithCodeException } from '../../common/exceptions/app.exceptions';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      include: { district: true },
      // Deterministic order: the default address first, then newest.
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    await this.assertDistrictExists(dto.districtId);
    // Clearing the old default and writing the new one must be one atomic
    // step — otherwise a failure between the two leaves the user with no
    // default, and two concurrent requests can leave two.
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: { ...dto, userId },
        include: { district: true },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    if (dto.districtId) await this.assertDistrictExists(dto.districtId);
    return this.prisma.$transaction(async (tx) => {
      // Ownership check scoped to the caller: another user's address is
      // indistinguishable from a nonexistent one (404, no existence leak).
      const address = await tx.address.findFirst({ where: { id, userId } });
      if (!address) throw new NotFoundException('Address not found');
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.address.update({ where: { id }, data: dto, include: { district: true } });
    });
  }

  async remove(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');
    try {
      // `deleteMany` with the owner in the filter: even if the row were
      // swapped between the check above and here, only the caller's own
      // row can ever be deleted.
      await this.prisma.address.deleteMany({ where: { id, userId } });
    } catch (err: any) {
      // orders.address_id has no ON DELETE rule in the live database, so an
      // address already used by an order cannot be hard-deleted yet (see
      // migration 20261010090000_order_address_on_delete_set_null). Return
      // a clear 409 instead of an opaque 500 until that migration is applied.
      if (err?.code === 'P2003') {
        throw new ConflictWithCodeException(
          'ADDRESS_IN_USE',
          'This address is linked to existing orders and cannot be deleted.',
        );
      }
      throw err;
    }
    return { message: 'Address removed' };
  }

  private async assertDistrictExists(districtId: string) {
    const district = await this.prisma.district.findUnique({
      where: { id: districtId },
      select: { id: true },
    });
    if (!district) throw new BadRequestException('Unknown district');
  }
}
