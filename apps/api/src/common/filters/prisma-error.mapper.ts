import { HttpStatus } from '@nestjs/common';

export interface MappedError {
  status: number;
  code: string;
  message: string;
}

// Duck-typed on purpose: Prisma error classes all carry a stable `name`
// and (for known request errors) a `code`, independent of client version,
// and this avoids a hard dependency on the generated client's class
// identity (which differs between the adapter-based and engine-based
// clients).
function errName(err: unknown): string {
  return typeof (err as any)?.name === 'string' ? (err as any).name : '';
}

/**
 * Which column(s) a P2002 hit. With driver adapters (Prisma 7 + adapter-pg)
 * `meta.target` is not always populated, so look at every place the
 * information can live and match on the column names we care about.
 */
function uniqueViolationFields(err: any): string[] {
  const meta = err?.meta ?? {};
  const fields: string[] = [];
  const target = meta.target;
  if (Array.isArray(target)) fields.push(...target.map(String));
  else if (typeof target === 'string') fields.push(target);
  const adapterFields = meta.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) fields.push(...adapterFields.map(String));
  const constraintName = meta.driverAdapterError?.cause?.constraint?.index;
  if (typeof constraintName === 'string') fields.push(constraintName);
  return fields.map((f) => f.toLowerCase());
}

const UNIQUE_FIELD_ERRORS: Array<{ match: string; code: string; message: string }> = [
  { match: 'phone', code: 'PHONE_ALREADY_EXISTS', message: 'An account already exists with this phone number.' },
  { match: 'email', code: 'EMAIL_ALREADY_EXISTS', message: 'An account already exists with this email.' },
  { match: 'username', code: 'USERNAME_ALREADY_EXISTS', message: 'This username is already taken.' },
];

/**
 * Translate a Prisma exception into a deliberate HTTP outcome. Returns null
 * for anything that isn't a recognised Prisma error (caller then treats it
 * as an unexpected 500). The returned message is always generic and safe to
 * show to a client — never the raw Prisma/SQL text.
 */
export function mapPrismaError(err: unknown): MappedError | null {
  const name = errName(err);
  const code = (err as any)?.code as string | undefined;

  if (name === 'PrismaClientKnownRequestError' && typeof code === 'string') {
    switch (code) {
      case 'P2002': {
        const fields = uniqueViolationFields(err);
        const hit = UNIQUE_FIELD_ERRORS.find((e) => fields.some((f) => f.includes(e.match)));
        return {
          status: HttpStatus.CONFLICT,
          code: hit?.code ?? 'ALREADY_EXISTS',
          message: hit?.message ?? 'A record with these details already exists.',
        };
      }
      case 'P2025': // record required by the operation not found
      case 'P2001':
      case 'P2015':
        return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'The requested resource was not found.' };
      case 'P2003': // foreign key constraint failed
      case 'P2014': // required relation violation
        return {
          status: HttpStatus.CONFLICT,
          code: 'RELATED_RECORD_CONFLICT',
          message: 'The operation conflicts with related data.',
        };
      case 'P2000': // value too long
      case 'P2005':
      case 'P2006':
      case 'P2007':
      case 'P2011': // null constraint
      case 'P2012': // missing required value
      case 'P2020':
        return { status: HttpStatus.BAD_REQUEST, code: 'INVALID_DATA', message: 'The submitted data is invalid.' };
      case 'P2024': // timed out fetching a connection from the pool
      case 'P1001': // can't reach database server
      case 'P1002': // database server timed out
      case 'P1008': // operation timed out
      case 'P1017': // server closed the connection
        return serviceUnavailable();
      case 'P2034': // transaction write conflict / deadlock
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONCURRENT_UPDATE',
          message: 'The request conflicted with another update. Please try again.',
        };
      default:
        return null;
    }
  }

  if (name === 'PrismaClientInitializationError') return serviceUnavailable();
  if (name === 'PrismaClientValidationError') {
    // A malformed query built by *our* code (wrong field/relation name),
    // not a client mistake — log as 500 so it is noticed, but never leak
    // the query text. Deliberately NOT mapped to 400.
    return null;
  }
  return null;
}

function serviceUnavailable(): MappedError {
  return {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: 'SERVICE_UNAVAILABLE',
    message: 'The service is temporarily unavailable. Please try again shortly.',
  };
}
