import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
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

  await app.listen(port,"0.0.0.0");

  console.log(`OTLOB API running on http://localhost:${port}/api`);
}

bootstrap();