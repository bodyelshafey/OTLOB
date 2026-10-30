/// <reference types="jest" />
import { BadRequestException, ConflictException, HttpStatus, NotFoundException, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { mapPrismaError } from './prisma-error.mapper';
import { ConflictWithCodeException } from '../exceptions/app.exceptions';
import { CreateAddressDto } from '../../modules/addresses/dto/create-address.dto';
import { UpdateAddressDto } from '../../modules/addresses/dto/update-address.dto';
import { RegisterDto } from '../../modules/auth/dto/register.dto';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host: any = {
    switchToHttp: () => ({
      getResponse: () => ({ status, headersSent: false }),
      getRequest: () => ({ method: 'POST', url: '/api/x', originalUrl: '/api/x?token=abc' }),
    }),
  };
  new HttpExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
}

const prismaErr = (code: string, meta?: any) =>
  Object.assign(new Error('raw SQL: INSERT INTO users ... secret'), { name: 'PrismaClientKnownRequestError', code, meta });

describe('HttpExceptionFilter', () => {
  it('flattens coded exceptions: top-level code, string message (the mobile duplicate-phone crash)', () => {
    const { status, body } = run(new ConflictWithCodeException('PHONE_ALREADY_EXISTS', 'An account already exists with this phone number.'));
    expect(status).toBe(409);
    expect(body.code).toBe('PHONE_ALREADY_EXISTS');
    expect(typeof body.message).toBe('string');
  });

  it('keeps extra fields (e.g. phone) top-level and never lets them override core fields', () => {
    const { body } = run(new ConflictException({ code: 'X', phone: '+20123', statusCode: 1, success: true, message: 'm' }));
    expect(body.phone).toBe('+20123');
    expect(body.success).toBe(false);
    expect(body.statusCode).toBe(409);
  });

  it('keeps validation messages as an array of strings', () => {
    const { status, body } = run(new BadRequestException(['phone must match', 'password too short']));
    expect(status).toBe(400);
    expect(body.message).toEqual(['phone must match', 'password too short']);
  });

  it('maps a Prisma unique violation to 409 with a safe message and no SQL', () => {
    const { status, body } = run(prismaErr('P2002', { target: ['phone'] }));
    expect(status).toBe(409);
    expect(body.code).toBe('PHONE_ALREADY_EXISTS');
    expect(JSON.stringify(body)).not.toMatch(/INSERT|secret|SQL/i);
  });

  it('reads the violated column from driver-adapter metadata too', () => {
    const { body } = run(prismaErr('P2002', { driverAdapterError: { cause: { constraint: { fields: ['email'] } } } }));
    expect(body.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it.each([
    ['P2025', 404], ['P2003', 409], ['P2000', 400], ['P2024', 503], ['P1001', 503], ['P2034', 409],
  ])('maps Prisma %s to HTTP %i', (code, expected) => {
    expect(run(prismaErr(code as string)).status).toBe(expected);
  });

  it('maps a database initialization failure to 503', () => {
    const e = Object.assign(new Error("Can't reach db.example.com:5432"), { name: 'PrismaClientInitializationError' });
    const { status, body } = run(e);
    expect(status).toBe(503);
    expect(JSON.stringify(body)).not.toContain('example.com');
  });

  it('returns a generic 500 for unexpected errors without leaking details or stack', () => {
    const { status, body } = run(new Error('secret db password leaked'));
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toMatch(/secret|stack/i);
  });

  it('does not throw for non-Error throwables or unknown Prisma codes', () => {
    expect(() => run('boom')).not.toThrow();
    expect(() => run(null)).not.toThrow();
    expect(mapPrismaError(prismaErr('P9999'))).toBeNull();
  });

  it('maps not-found HttpExceptions through unchanged', () => {
    expect(run(new NotFoundException('Address not found')).status).toBe(HttpStatus.NOT_FOUND);
  });
});

describe('DTO validation (global ValidationPipe settings)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true });

  it('rejects a malformed phone on registration with 400', async () => {
    await expect(
      pipe.transform({ fullName: 'Ab', phone: 'abc', password: 'password123' }, { type: 'body', metatype: RegisterDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes a local Egyptian phone on registration', async () => {
    const dto: any = await pipe.transform({ fullName: 'Ab', phone: '01234567890', password: 'password123' }, { type: 'body', metatype: RegisterDto });
    expect(dto.phone).toBe('+201234567890');
  });

  it('address PATCH rejects smuggled columns such as userId (mass-assignment fix)', async () => {
    await expect(
      pipe.transform({ userId: 'someone-else' }, { type: 'body', metatype: UpdateAddressDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('address create rejects invalid input', async () => {
    await expect(
      pipe.transform({ districtId: 'nope', fullAddress: '' }, { type: 'body', metatype: CreateAddressDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
