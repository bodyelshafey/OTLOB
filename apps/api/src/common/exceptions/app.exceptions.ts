import { ConflictException, ForbiddenException } from '@nestjs/common';

// Project-wide structured error shape (2026-09-13): every error the
// frontend needs to distinguish by TYPE (not just by reading the message
// string) carries a stable `code`, e.g.:
//   { statusCode: 409, code: 'PHONE_ALREADY_EXISTS', message: '...' }
// Nest's HttpException renders whatever plain object you pass it as the
// response body (plus statusCode), so this is a thin, reusable wrapper —
// not a new error-handling mechanism. Frontends should switch on `code`,
// never parse `message`, since `message` is allowed to be reworded without
// that being a breaking API change.
export class ConflictWithCodeException extends ConflictException {
  constructor(code: string, message: string) {
    super({ code, message });
  }
}

export class ForbiddenWithCodeException extends ForbiddenException {
  constructor(code: string, message: string) {
    super({ code, message });
  }
}
