import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from './common/decorators/public.decorator';
import { HealthService } from './health.service';

// Unauthenticated and exempt from the global rate limiter on purpose: these
// are probe endpoints (platform healthchecks, uptime monitors, mobile clients
// choosing between APIs). Throttling them would turn a busy moment into a
// false "API is down" signal.
//
//   GET /api/health        legacy contract, unchanged: always 200, body says ok|degraded
//   GET /api/health/live   liveness  — process is up; no dependencies touched.
//                          Point the Railway healthcheck here.
//   GET /api/health/ready  readiness — 200 when the database answers, 503 when not.
//                          What clients should use to decide whether to trust this API.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Public()
  @Get()
  async check() {
    const database = await this.health.checkDatabase();
    const timestamp = new Date().toISOString();
    return database === 'up'
      ? { status: 'ok', database: 'up', timestamp }
      : { status: 'degraded', database: 'down', timestamp };
  }

  @Public()
  @Get('live')
  live() {
    return this.health.liveness();
  }

  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const body = await this.health.readiness();
    if (body.status !== 'ok') res.status(503);
    return body;
  }
}
