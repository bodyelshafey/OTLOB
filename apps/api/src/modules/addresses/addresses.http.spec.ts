/// <reference types="jest" />
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

// Real Nest HTTP pipeline (routing, ValidationPipe, ParseUUIDPipe, global
// filter) with a stubbed database. The auth guard is replaced by a fixed
// caller because this test targets error handling and isolation, not JWT.
describe('Addresses HTTP — error handling & process stability', () => {
  let app: INestApplication;
  let prisma: any;
  let base: string;

  // Tiny helper over Node's built-in fetch (no extra test dependency).
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  beforeAll(async () => {
    prisma = {
      address: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
      district: { findUnique: jest.fn().mockResolvedValue({ id: 'd' }) },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    const ref = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [AddressesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    app = ref.createNestApplication();
    app.use((req: any, _res: any, next: any) => { req.user = { id: 'user-1' }; next(); });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0);
    base = await app.getUrl();
    base = base.replace('[::1]', '127.0.0.1');
  });
  afterAll(() => app.close());

  it('GET → 200 [] for a user with no addresses', async () => {
    prisma.address.findMany.mockResolvedValue([]);
    const res = await call('GET', '/addresses');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('malformed id → 400 (not 500)', async () => {
    const res = await call('DELETE', '/addresses/not-a-uuid');
    expect(res.status).toBe(400);
    expect(typeof res.body.message === 'string' || Array.isArray(res.body.message)).toBe(true);
  });

  it('unknown / someone else\'s id → 404', async () => {
    prisma.address.findFirst.mockResolvedValue(null);
    const res = await call('PATCH', '/addresses/00000000-0000-4000-8000-000000000000', { label: 'x' });
    expect(res.status).toBe(404);
  });

  it('PATCH with a smuggled userId → 400 and nothing written', async () => {
    const res = await call('PATCH', '/addresses/00000000-0000-4000-8000-000000000000', { userId: 'victim' });
    expect(res.status).toBe(400);
    expect(prisma.address.update).not.toHaveBeenCalled();
  });

  it('database outage → controlled 503 with no internals; server keeps serving afterwards', async () => {
    prisma.address.findMany.mockRejectedValueOnce(
      Object.assign(new Error("Can't reach database server at db.internal:5432"), { name: 'PrismaClientInitializationError' }),
    );
    const bad = await call('GET', '/addresses');
    expect(bad.status).toBe(503);
    expect(JSON.stringify(bad.body)).not.toContain('db.internal');

    prisma.address.findMany.mockResolvedValue([{ id: 'a1' }]);
    const ok = await call('GET', '/addresses');
    expect(ok.status).toBe(200);
  });

  it('unexpected exception → generic 500, no stack/SQL, server keeps serving', async () => {
    prisma.address.findMany.mockRejectedValueOnce(new Error('SELECT * FROM addresses -- secret'));
    const res = await call('GET', '/addresses');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/SELECT|secret|at Object/);
    prisma.address.findMany.mockResolvedValue([]);
    expect((await call('GET', '/addresses')).status).toBe(200);
  });
});
