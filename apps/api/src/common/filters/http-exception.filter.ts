import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { mapPrismaError, MappedError } from './prisma-error.mapper';

/**
 * Global exception filter.
 *
 * Response contract:
 *   { success: false, statusCode, path, timestamp, message, code?, ...extras }
 *
 *  - `message` is ALWAYS a string (or string[] for validation errors) — never
 *    an object. Previously `exception.getResponse()` was nested wholesale
 *    under `message`, so coded errors arrived as
 *    `{ message: { code, message } }` and ValidationPipe errors as
 *    `{ message: { statusCode, message[], error } }`. Clients read a
 *    top-level `body.code` / `body.phone` (never found there) and rendered
 *    `body.message` directly, which crashes React Native with "Objects are
 *    not valid as a React child" — e.g. on a duplicate-phone registration.
 *  - `code` (and any other fields a coded exception carries, e.g. `phone` on
 *    PHONE_VERIFICATION_REQUIRED) are now top-level, which is where every
 *    existing client already looks for them.
 *
 * Prisma failures are mapped deliberately (see prisma-error.mapper.ts) — a
 * unique-constraint race is a 409, a missing row a 404, an unreachable DB a
 * 503 — instead of every one of them collapsing into an opaque 500. Raw
 * database messages, SQL and stack traces are only ever logged server-side.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    // Nothing in here may throw: an exception inside an exception filter
    // would leave the request hanging with no response.
    try {
      this.handle(exception, host);
    } catch (filterError) {
      try {
        const response = host.switchToHttp().getResponse<Response>();
        if (!response.headersSent) {
          response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
          });
        }
      } catch {
        // Response already unusable — nothing more we can safely do.
      }
    }
  }

  private handle(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];
    let code: string | undefined;
    let extras: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { message: bodyMessage, statusCode: _statusCode, code: bodyCode, ...rest } =
          body as Record<string, unknown>;
        message =
          typeof bodyMessage === 'string' || Array.isArray(bodyMessage)
            ? (bodyMessage as string | string[])
            : exception.message;
        if (typeof bodyCode === 'string') code = bodyCode;
        extras = rest;
      }
    } else {
      const mapped: MappedError | null = mapPrismaError(exception);
      if (mapped) {
        status = mapped.status;
        code = mapped.code;
        message = mapped.message;
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = 'INTERNAL_ERROR';
        message = 'Internal server error';
      }
    }

    this.log(request, status, exception);

    // Only genuinely unexpected failures (5xx — a bug or an outage, not a
    // validation error or an expected 401/403/404/409) go to Sentry.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Sentry.captureException(exception, {
        tags: { path: request.url, method: request.method },
      });
    }

    response.status(status).json({
      // Extras first so they can never overwrite the core fields below.
      ...extras,
      success: false,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
      ...(code ? { code } : {}),
    });
  }

  private log(request: Request, status: number, exception: unknown) {
    try {
      // Path only (no query string) — query strings can carry tokens/phones.
      const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
      const line = `${request.method} ${path} -> ${status}`;
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(
          line,
          exception instanceof Error ? exception.stack : String(exception),
        );
      } else {
        // Expected client errors: one line, no stack trace noise.
        this.logger.warn(line);
      }
    } catch {
      // Logging must never throw.
    }
  }
}
