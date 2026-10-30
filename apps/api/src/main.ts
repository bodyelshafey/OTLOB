import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Fail fast, with a clear message, if a variable the API cannot work
// without is missing — instead of surfacing later as a confusing 500 on the
// first login/register (JWT signing) or first DB query. Only names are ever
// logged, never values. Redis is deliberately NOT required here: BullMQ
// problems must never keep the HTTP API from starting (see JobsService).
function assertRequiredEnv() {
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error(
      `Configuration error: missing required environment variable(s): ${missing.join(', ')}. ` +
        'Set them in apps/api/.env (local) or in the host\'s environment settings (e.g. Railway).',
    );
    process.exit(1);
  }
  // Placeholder secrets copied from .env.example would sign tokens anyone can forge.
  if (
    process.env.NODE_ENV === 'production' &&
    ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].some((n) => process.env[n]!.startsWith('change_me'))
  ) {
    console.error(
      'Configuration error: JWT_ACCESS_SECRET / JWT_REFRESH_SECRET still hold the .env.example placeholder values. Set real random secrets before running in production.',
    );
    process.exit(1);
  }
}

async function bootstrap() {
  assertRequiredEnv();
  const app = await NestFactory.create(AppModule);

  // Behind a reverse proxy (Railway, or any PaaS/load balancer in front of
  // this API), Express's req.ip is the proxy's IP for every request unless
  // told to trust the X-Forwarded-For header from the first hop. Without
  // this, per-IP rate limiting effectively becomes one shared bucket for
  // all users, and audit-log IP addresses are meaningless.
  // INestApplication doesn't type-expose Express's .set() directly — go
  // through the underlying HTTP adapter instance, which does.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet());

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://otlob-five.vercel.app',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // Lets Nest run onModuleDestroy (Prisma's clean $disconnect above, and
  // @nestjs/bullmq's own worker-shutdown hook) on SIGTERM/SIGINT instead of
  // the process just dying mid-request/mid-job when a PaaS restarts or
  // scales the instance down.
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('OTLOB API')
    .setDescription('Multi-vendor marketplace API for New Administrative Capital')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT) || 4000;
  // Not the root cause of the original hang (both `app.listen(port)` and
  // `app.listen(port, '0.0.0.0')` were already tried and both hung, because
  // the real block was upstream in JobsService.onModuleInit — see that
  // file). Kept anyway per the requested production-grade startup: Railway
  // (and most PaaS) require binding 0.0.0.0 to be reachable, while
  // 127.0.0.1 is the safer default for local dev.
  //
  // HOST overrides the default. Local mobile testing needs HOST=0.0.0.0:
  // with the 127.0.0.1 default an Android emulator (via 10.0.2.2) or a
  // physical device on the LAN can never reach the API, because 127.0.0.1 is
  // only reachable from the machine itself.
  const host =
    process.env.HOST?.trim() ||
    (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

  try {
    await app.listen(port, host);
    console.log(`OTLOB API running on http://${host}:${port}/api`);
  } catch (error) {
    console.error('Failed to start OTLOB API:', error);
    process.exit(1);
  }
}

bootstrap();