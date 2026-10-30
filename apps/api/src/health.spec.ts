/// <reference types="jest" />
import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from './prisma/prisma.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// A route the global rate limiter DOES apply to, as a control for the
// "probes are exempt" assertions below.
@Controller('control')
class ControlController {
  @Get()
  get() {
    return { ok: true };
  }
}

describe('HealthService', () => {
  let queryRaw: jest.Mock;
  let service: HealthService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-25T10:00:00Z'));
    queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    service = new HealthService({ $queryRaw: queryRaw } as unknown as PrismaService);
  });
  afterEach(() => jest.useRealTimers());

  it('liveness never touches the database', () => {
    const body = service.liveness();
    expect(body).toMatchObject({ status: 'ok', service: 'otlob-api' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('readiness is ok when the database answers', async () => {
    const body = await service.readiness();
    expect(body).toMatchObject({ status: 'ok', checks: { database: 'up' } });
  });

  it('readiness is unavailable when the database query fails', async () => {
    queryRaw.mockRejectedValue(new Error('connection refused'));
    const body = await service.readiness();
    expect(body).toMatchObject({ status: 'unavailable', checks: { database: 'down' } });
  });

  it('treats a hung database as down after the bounded timeout (does not hang the probe)', async () => {
    queryRaw.mockReturnValue(new Promise(() => {})); // never settles
    const pending = service.readiness();
    await jest.advanceTimersByTimeAsync(HealthService.DB_TIMEOUT_MS + 1);
    await expect(pending).resolves.toMatchObject({ checks: { database: 'down' } });
  });

  it('caches the result so frequent probes cost one DB round-trip per window', async () => {
    await service.checkDatabase();
    await service.checkDatabase();
    await service.checkDatabase();
    expect(queryRaw).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + HealthService.OK_TTL_MS + 1);
    await service.checkDatabase();
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight query between concurrent callers (no stampede)', async () => {
    let resolve!: (v: unknown) => void;
    queryRaw.mockReturnValue(new Promise((r) => (resolve = r)));
    const results = Promise.all([service.checkDatabase(), service.checkDatabase(), service.checkDatabase()]);
    resolve([1]);
    await expect(results).resolves.toEqual(['up', 'up', 'up']);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('re-checks a failed database sooner than a healthy one', async () => {
    queryRaw.mockRejectedValueOnce(new Error('down')).mockResolvedValue([1]);
    expect(await service.checkDatabase()).toBe('down');
    jest.setSystemTime(Date.now() + HealthService.DOWN_TTL_MS + 1);
    expect(await service.checkDatabase()).toBe('up');
  });
});

describe('Health HTTP', () => {
  let app: INestApplication;
  let queryRaw: jest.Mock;
  let base: string;
  const SECRET_URL = 'postgresql://svc_user:SuperSecretPw123@db.internal.example:6543/postgres';
  const originalDbUrl = process.env.DATABASE_URL;

  const get = async (path: string) => {
    const res = await fetch(base + path);
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) };
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = SECRET_URL;
    queryRaw = jest.fn().mockResolvedValue([1]);
    const moduleRef = await Test.createTestingModule({
      // limit 3/min makes the control route trip quickly if throttling applies
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 3 }])],
      controllers: [HealthController, ControlController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    process.env.DATABASE_URL = originalDbUrl;
    await app.close();
  });

  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue([1]);
  });

  it('GET /api/health/live → 200 without touching the database', async () => {
    const r = await get('/api/health/live');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'ok', service: 'otlob-api' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('GET /api/health/ready → 200 when the database is up', async () => {
    const r = await get('/api/health/ready');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'ok', service: 'otlob-api', checks: { database: 'up' } });
  });

  it('GET /api/health/ready → 503 when the database is down (so clients/LBs stop trusting it)', async () => {
    // Wait out the cached "up" from the previous test.
    await new Promise((r) => setTimeout(r, 0));
    (app.get(HealthService) as any).cached = null;
    queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));
    const r = await get('/api/health/ready');
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ status: 'unavailable', checks: { database: 'down' } });
  });

  it('legacy GET /api/health keeps its contract: always 200, status says ok|degraded', async () => {
    (app.get(HealthService) as any).cached = null;
    const up = await get('/api/health');
    expect(up.status).toBe(200);
    expect(up.body).toMatchObject({ status: 'ok', database: 'up' });

    (app.get(HealthService) as any).cached = null;
    queryRaw.mockRejectedValue(new Error('down'));
    const down = await get('/api/health');
    expect(down.status).toBe(200);
    expect(down.body).toMatchObject({ status: 'degraded', database: 'down' });
  });

  it('never leaks connection strings, credentials or hostnames in any health response', async () => {
    (app.get(HealthService) as any).cached = null;
    for (const path of ['/api/health', '/api/health/live', '/api/health/ready']) {
      const { text } = await get(path);
      for (const secret of ['SuperSecretPw123', 'svc_user', 'db.internal.example', 'postgres://', 'postgresql://']) {
        expect(text).not.toContain(secret);
      }
    }
  });

  it('probe endpoints are exempt from the global rate limiter (control route is not)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await get('/api/health/live')).status);
    for (let i = 0; i < 12; i++) statuses.push((await get('/api/health/ready')).status);
    expect(statuses.every((s) => s === 200)).toBe(true);

    const control: number[] = [];
    for (let i = 0; i < 6; i++) control.push((await fetch(base + '/api/control')).status);
    expect(control).toContain(429); // proves the guard IS active, so the 200s above are the exemption
  });
});
