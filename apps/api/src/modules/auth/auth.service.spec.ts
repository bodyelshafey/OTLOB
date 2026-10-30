import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PrismaService } from '../../prisma/prisma.service';

// Real argon2 (not mocked) — these tests exercise actual hash/verify so a
// broken hashing call would actually fail, not just satisfy a stub.
jest.setTimeout(15000);

// PIVOTED 2026-09-13: rewritten again for the phone-first pivot — phone is
// now the sole primary registration/login identity, email is a fully
// optional post-registration step. Supersedes the 2026-09-12 version of
// this file, which tested "both email AND phone mandatory".
describe('AuthService — phone-first auth, optional email', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    verificationCode: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let otpService: {
    generateCode: jest.Mock;
    sendVerificationCode: jest.Mock;
    sendPhoneVerificationCode: jest.Mock;
    sendPasswordResetCode: jest.Mock;
  };

  const baseUser = {
    id: 'user-1',
    fullName: 'Test User',
    email: null as string | null,
    phone: '+201234567890',
    emailVerified: false,
    phoneVerified: false,
    isActive: true,
    role: 'USER',
    googleId: null,
    passwordHash: 'hashed',
    refreshToken: null,
  };

  beforeEach(async () => {
    process.env.SKIP_EMAIL_DOMAIN_CHECK = 'true';
    process.env.JWT_ACCESS_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';

    prisma = {
      user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      verificationCode: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
    };
    otpService = {
      generateCode: jest.fn().mockReturnValue('123456'),
      sendVerificationCode: jest.fn().mockResolvedValue(undefined),
      sendPhoneVerificationCode: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('signed-token'), verifyAsync: jest.fn() } },
        { provide: OtpService, useValue: otpService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('creates an unverified account from phone+password only and sends a phone code, issuing no tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no existing phone
      prisma.user.create.mockResolvedValue({ ...baseUser });

      const result = await service.register({
        fullName: 'Test User', phone: '+201234567890', password: 'password123',
      });

      expect(result).toEqual({
        message: expect.any(String),
        phone: '+201234567890',
        phoneVerified: false,
      });
      expect((result as any).accessToken).toBeUndefined();
      expect(otpService.sendPhoneVerificationCode).toHaveBeenCalledTimes(1);
      // No email step at registration at all anymore.
      expect(otpService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('rejects a duplicate phone with a structured PHONE_ALREADY_EXISTS error', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      try {
        await service.register({ fullName: 'X', phone: '+201234567890', password: 'password123' });
        fail('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        expect((err as any).getResponse()).toMatchObject({ code: 'PHONE_ALREADY_EXISTS' });
      }
    });

    it('converts a concurrent-registration P2002 unique violation into the same structured error', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const p2002 = Object.assign(new Error('duplicate'), { code: 'P2002', meta: { target: ['phone'] } });
      prisma.user.create.mockRejectedValue(p2002);
      try {
        await service.register({ fullName: 'X', phone: '+201234567890', password: 'password123' });
        fail('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        expect((err as any).getResponse()).toMatchObject({ code: 'PHONE_ALREADY_EXISTS' });
      }
    });
  });

  describe('register — duplicate handling (no side effects)', () => {
    it('on a duplicate phone: creates no account, hashes nothing, and sends NO verification message', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      await expect(
        service.register({ fullName: 'X', phone: '+201234567890', password: 'password123' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.verificationCode.create).not.toHaveBeenCalled();
      expect(otpService.sendPhoneVerificationCode).not.toHaveBeenCalled();
    });

    it('on a concurrent-registration race: exactly one request succeeds, the other gets 409 and triggers no OTP', async () => {
      // Both requests pass the application-level pre-check (neither row exists
      // yet); only the database unique constraint can separate them.
      prisma.user.findUnique.mockResolvedValue(null);
      let created = 0;
      prisma.user.create.mockImplementation(async () => {
        created += 1;
        if (created === 1) return { ...baseUser };
        throw Object.assign(new Error('Unique constraint failed'), {
          name: 'PrismaClientKnownRequestError',
          code: 'P2002',
          meta: { target: ['phone'] },
        });
      });

      const dto = { fullName: 'X', phone: '+201234567890', password: 'password123' };
      const results = await Promise.allSettled([service.register(dto), service.register(dto)]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      expect(rejected[0].reason.getResponse()).toMatchObject({ code: 'PHONE_ALREADY_EXISTS' });
      expect(otpService.sendPhoneVerificationCode).toHaveBeenCalledTimes(1);
    });

    it('does not swallow a non-unique database failure as a conflict', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        Object.assign(new Error('connection refused'), { name: 'PrismaClientInitializationError' }),
      );
      await expect(
        service.register({ fullName: 'X', phone: '+201234567890', password: 'password123' }),
      ).rejects.toThrow('connection refused');
      expect(otpService.sendPhoneVerificationCode).not.toHaveBeenCalled();
    });
  });

  describe('login — phone-or-email identifier, phone-only verification gate', () => {
    it('looks up by phone when the identifier has no "@"', async () => {
      const hash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash, phoneVerified: true });
      await service.login({ identifier: '+201234567890', password: 'correct-password' });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { phone: '+201234567890' } });
    });

    it('finds an account registered as +201… when the user types the local 01… format at login', async () => {
      const hash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockImplementation(async ({ where }: any) =>
        where.phone === '+201234567890'
          ? { ...baseUser, passwordHash: hash, phoneVerified: true }
          : null,
      );
      const result = await service.login({ identifier: '01234567890', password: 'correct-password' });
      expect((result as any).accessToken).toBeDefined();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { phone: '+201234567890' } });
    });

    it('still finds a legacy account whose phone was stored un-normalized', async () => {
      const hash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockImplementation(async ({ where }: any) =>
        where.phone === '01143677691'
          ? { ...baseUser, phone: '01143677691', passwordHash: hash, phoneVerified: true }
          : null,
      );
      const result = await service.login({ identifier: '01143677691', password: 'correct-password' });
      expect((result as any).accessToken).toBeDefined();
    });

    it('looks up by email when the identifier contains "@" (legacy phone-less accounts)', async () => {
      const hash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, phone: null, email: 'admin@otlob.app', passwordHash: hash, phoneVerified: true });
      await service.login({ identifier: 'admin@otlob.app', password: 'correct-password' });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'admin@otlob.app' } });
    });

    it('rejects wrong password with a generic error (no user-enumeration signal)', async () => {
      const hash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });
      await expect(
        service.login({ identifier: '+201234567890', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects correct credentials with 403/PHONE_VERIFICATION_REQUIRED when phone is unverified', async () => {
      const hash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash, phoneVerified: false });
      try {
        await service.login({ identifier: '+201234567890', password: 'correct-password' });
        fail('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect((err as any).getResponse()).toMatchObject({ code: 'PHONE_VERIFICATION_REQUIRED' });
      }
    });

    it('issues tokens once phoneVerified is true — email verification is never checked', async () => {
      const hash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash, phoneVerified: true, emailVerified: false });
      const result = await service.login({ identifier: '+201234567890', password: 'correct-password' });
      expect(result).toHaveProperty('accessToken');
    });

    it('rejects a deactivated account even with correct credentials and verified phone', async () => {
      const hash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash, phoneVerified: true, isActive: false });
      await expect(
        service.login({ identifier: '+201234567890', password: 'correct-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyPhone — the ONLY registration verification step now', () => {
    const codeHashPromise = argon2.hash('123456');

    it('issues tokens immediately on success (no second step to wait for)', async () => {
      const codeHash = await codeHashPromise;
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, phoneVerified: false });
      prisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-1', codeHash, attempts: 0, expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
      });
      prisma.user.update.mockResolvedValue({ ...baseUser, phoneVerified: true });

      const result = await service.verifyPhone({ phone: '+201234567890', code: '123456' });
      expect(result).toHaveProperty('accessToken');
    });

    it('rejects an expired code', async () => {
      const codeHash = await codeHashPromise;
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-2', codeHash, attempts: 0, expiresAt: new Date(Date.now() - 1000), consumedAt: null,
      });
      await expect(service.verifyPhone({ phone: '+201234567890', code: '123456' })).rejects.toThrow(BadRequestException);
    });

    it('rejects a wrong code and increments attempts', async () => {
      const codeHash = await codeHashPromise;
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-3', codeHash, attempts: 0, expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
      });
      await expect(service.verifyPhone({ phone: '+201234567890', code: '000000' })).rejects.toThrow(BadRequestException);
      expect(prisma.verificationCode.update).toHaveBeenCalledWith({
        where: { id: 'code-3' },
        data: { attempts: { increment: 1 } },
      });
    });

    // The atomicity requirement carried over from the 2026-09-12 rebuild:
    // two concurrent requests submitting the same valid code. Only the
    // request whose conditional UPDATE actually matches a row
    // (consumedAt IS NULL) may succeed.
    it('CONCURRENCY: of two simultaneous verifications with the same valid code, exactly one succeeds', async () => {
      const codeHash = await codeHashPromise;
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-race', codeHash, attempts: 0, expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
      });
      let firstCallDone = false;
      prisma.verificationCode.updateMany.mockImplementation(() => {
        if (!firstCallDone) {
          firstCallDone = true;
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      });
      prisma.user.update.mockResolvedValue({ ...baseUser, phoneVerified: true });

      const [a, b] = await Promise.allSettled([
        service.verifyPhone({ phone: '+201234567890', code: '123456' }),
        service.verifyPhone({ phone: '+201234567890', code: '123456' }),
      ]);
      const succeeded = [a, b].filter((r) => r.status === 'fulfilled');
      const failed = [a, b].filter((r) => r.status === 'rejected');
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });
  });

  describe('resend cooldown (phone)', () => {
    it('rejects a resend within the cooldown window', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, phoneVerified: false });
      prisma.verificationCode.findFirst.mockResolvedValue({ id: 'code-4', createdAt: new Date() });
      await expect(service.resendPhoneCode({ phone: '+201234567890' })).rejects.toThrow(BadRequestException);
    });

    it('does not reveal whether the phone exists or is already verified', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.resendPhoneCode({ phone: '+201000000000' });
      expect(result).toEqual({ message: expect.any(String) });
    });
  });

  describe('addEmail — optional, no OTP', () => {
    it('saves the email directly with no verification code sent', async () => {
      prisma.user.findFirst.mockResolvedValue(null); // no existing user with this email
      prisma.user.update.mockResolvedValue({ ...baseUser, email: 'new@example.com' });

      const result = await service.addEmail('user-1', { email: 'new@example.com' });
      expect(result).toEqual({ message: expect.any(String), email: 'new@example.com' });
      expect(otpService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('rejects a duplicate email with a structured EMAIL_ALREADY_EXISTS error', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...baseUser, id: 'someone-else', email: 'taken@example.com' });
      try {
        await service.addEmail('user-1', { email: 'taken@example.com' });
        fail('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictException);
        expect((err as any).getResponse()).toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
      }
    });
  });

  describe('Google Sign-In', () => {
    it('flags phoneVerificationRequired when a Google account has no verified phone', async () => {
      (service as any).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({ sub: 'g-1', email: 'g@example.com', email_verified: true, name: 'G User' }),
        }),
      };
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // no user by googleId
        .mockResolvedValueOnce(null); // no user by email
      prisma.user.create.mockResolvedValue({ ...baseUser, id: 'g-user', email: 'g@example.com', googleId: 'g-1', emailVerified: true, phone: null, phoneVerified: false });

      const result = await service.googleAuth({ idToken: 'fake' } as any);
      expect((result as any).phoneVerificationRequired).toBe(true);
      expect(result).toHaveProperty('accessToken');
    });
  });
});
