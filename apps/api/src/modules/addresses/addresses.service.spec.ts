/// <reference types="jest" />
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AddressesService', () => {
  let service: AddressesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      address: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
      district: { findUnique: jest.fn().mockResolvedValue({ id: 'd1' }) },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    const ref = await Test.createTestingModule({
      providers: [AddressesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = ref.get(AddressesService);
  });

  it("lists only the caller's addresses; empty list is []", async () => {
    prisma.address.findMany.mockResolvedValue([]);
    await expect(service.findAll('u1')).resolves.toEqual([]);
    expect(prisma.address.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
  });

  it('cannot update or delete another user\'s address (404, nothing written)', async () => {
    prisma.address.findFirst.mockResolvedValue(null);
    await expect(service.update('u1', 'a-other', { label: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('u1', 'a-other')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.address.update).not.toHaveBeenCalled();
    expect(prisma.address.deleteMany).not.toHaveBeenCalled();
    expect(prisma.address.findFirst.mock.calls[0][0].where).toEqual({ id: 'a-other', userId: 'u1' });
  });

  it('returns 404 for a nonexistent address id', async () => {
    prisma.address.findFirst.mockResolvedValue(null);
    await expect(service.remove('u1', '00000000-0000-4000-8000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create with isDefault clears the old default inside the same transaction', async () => {
    prisma.address.create.mockResolvedValue({ id: 'a1' });
    await service.create('u1', { districtId: 'd1', fullAddress: 'x', isDefault: true });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.address.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, data: { isDefault: false } });
  });

  it('update to default only unsets the caller\'s OTHER addresses', async () => {
    prisma.address.findFirst.mockResolvedValue({ id: 'a1', userId: 'u1' });
    prisma.address.update.mockResolvedValue({ id: 'a1' });
    await service.update('u1', 'a1', { isDefault: true });
    expect(prisma.address.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', id: { not: 'a1' } }, data: { isDefault: false } });
  });

  it('rejects an unknown district with 400 before writing', async () => {
    prisma.district.findUnique.mockResolvedValue(null);
    await expect(service.create('u1', { districtId: 'd9', fullAddress: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.address.create).not.toHaveBeenCalled();
  });

  it('returns 409 ADDRESS_IN_USE (not a 500) when an order still references the address', async () => {
    prisma.address.findFirst.mockResolvedValue({ id: 'a1', userId: 'u1' });
    prisma.address.deleteMany.mockRejectedValue(Object.assign(new Error('fk'), { code: 'P2003' }));
    const err: any = await service.remove('u1', 'a1').catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({ code: 'ADDRESS_IN_USE' });
  });
});
