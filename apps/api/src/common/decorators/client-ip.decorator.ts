import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Relies on `app.set('trust proxy', 1)` in main.ts to be accurate behind a
// reverse proxy — req.ip already resolves X-Forwarded-For correctly once
// that's set, so this is just a thin, readable wrapper around it.
export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest();
  return request.ip;
});
