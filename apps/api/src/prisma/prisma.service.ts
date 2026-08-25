import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  // Only actually runs if app.enableShutdownHooks() is called in main.ts —
  // without a clean disconnect here, a SIGTERM (sent by Railway/most PaaS
  // during deploys or scale-down) kills the process mid-query instead of
  // closing the connection pool properly.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}