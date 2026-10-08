import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
      // Startup-hang fix, 2026-09-26: `pg.Pool` defaults to
      // connectionTimeoutMillis: 0 ("wait forever"). Combined with
      // onModuleInit() below (called from *inside* app.listen()'s own
      // internal init(), not before it), an unreachable DB — or one
      // silently black-holed by a firewall/VPN rather than actively
      // refusing the connection — used to hang the entire HTTP API
      // forever with no error. A real, bounded timeout lets the pool
      // itself fail properly instead of waiting indefinitely.
      connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 15_000),
    });

    super({ adapter });
  }

  async onModuleInit() {
    // Unlike the Redis-backed auto-delivery scan in JobsService (best-effort,
    // retried in the background), the database is not optional — almost
    // every route needs it. So this deliberately does the opposite of that
    // fix: instead of letting startup continue without it, fail fast with a
    // clear, actionable error the moment the bounded connect attempt above
    // is exhausted, rather than either hanging forever (the old behavior)
    // or silently starting an HTTP server that would 500 on nearly every
    // request.
    try {
      await this.$connect();
    } catch (err) {
      this.logger.error(
        `Could not connect to the database: ${(err as Error).message}. Check DATABASE_URL and network/firewall access to it.`,
      );
      process.exit(1);
    }
  }

  // Only actually runs if app.enableShutdownHooks() is called in main.ts —
  // without a clean disconnect here, a SIGTERM (sent by Railway/most PaaS
  // during deploys or scale-down) kills the process mid-query instead of
  // closing the connection pool properly.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}