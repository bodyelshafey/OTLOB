import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export type DatabaseState = 'up' | 'down';

/**
 * Process vs. dependency health, kept deliberately separate:
 *
 *  - liveness()  — "is this process running?" Touches nothing external, so it
 *    is safe to hit as often as a platform probe likes (Railway healthcheck,
 *    uptime monitors).
 *  - readiness() — "can this instance actually serve requests?" Verifies the
 *    database with a bounded `SELECT 1`. The result is cached for a few
 *    seconds and shared between concurrent callers, so many clients polling
 *    (e.g. mobile apps deciding which API to use) cost at most one database
 *    round-trip per cache window, never one per request.
 *
 * Nothing here exposes connection strings, credentials or internal hostnames:
 * only coarse up/down states.
 */
@Injectable()
export class HealthService {
  static readonly OK_TTL_MS = 5_000;
  static readonly DOWN_TTL_MS = 2_000;
  static readonly DB_TIMEOUT_MS = 2_000;

  private cached: { state: DatabaseState; expiresAt: number } | null = null;
  private inflight: Promise<DatabaseState> | null = null;

  constructor(private prisma: PrismaService) {}

  /** Where this instance is running — informational, not sensitive. */
  private runtime(): 'railway' | 'local' {
    return process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME
      ? 'railway'
      : 'local';
  }

  liveness() {
    return {
      status: 'ok' as const,
      service: 'otlob-api',
      runtime: this.runtime(),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async checkDatabase(): Promise<DatabaseState> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) return this.cached.state;
    if (this.inflight) return this.inflight;

    this.inflight = this.pingDatabase()
      .then((state) => {
        this.cached = {
          state,
          expiresAt:
            Date.now() +
            (state === 'up' ? HealthService.OK_TTL_MS : HealthService.DOWN_TTL_MS),
        };
        return state;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  async readiness() {
    const database = await this.checkDatabase();
    return {
      status: database === 'up' ? ('ok' as const) : ('unavailable' as const),
      service: 'otlob-api',
      runtime: this.runtime(),
      checks: { database },
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async pingDatabase(): Promise<DatabaseState> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<DatabaseState>((resolve) => {
      timer = setTimeout(() => resolve('down'), HealthService.DB_TIMEOUT_MS);
    });
    const ping = this.prisma
      .$queryRaw`SELECT 1`
      .then((): DatabaseState => 'up')
      .catch((): DatabaseState => 'down');
    try {
      return await Promise.race([ping, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
