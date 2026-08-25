import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    verificationCode: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let otpService: { generateCode: jest.Mock; sendVerificationCode: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      verificationCode: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };
    otpService = {
      generateCode: jest.fn().mockReturnValue('123456'),
      sendVerificationCode: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: OtpService, useValue: otpService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('throws ConflictException if the email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          fullName: 'Test User',
          email: 'test@otlob.app',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates an unverified account and emails a code instead of returning tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        fullName: 'Test User',
        email: 'test@otlob.app',
        role: 'USER',
        passwordHash: 'hashed',
        isVerified: false,
        refreshToken: null,
      });
      prisma.verificationCode.create.mockResolvedValue({});

      const result = await service.register({
        fullName: 'Test User',
        email: 'test@otlob.app',
        password: 'password123',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      const createArgs = prisma.user.create.mock.calls[0][0].data;
      // The plaintext password should never be persisted directly.
      expect(createArgs.passwordHash).not.toBe('password123');

      // No tokens yet — the account still needs to be verified.
      expect(result).not.toHaveProperty('accessToken');
      expect(result.requiresVerification).toBe(true);
      expect(result.email).toBe('test@otlob.app');
      expect(otpService.sendVerificationCode).toHaveBeenCalledWith(
        'test@otlob.app',
        'Test User',
        '123456',
      );
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for a non-existent email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@otlob.app', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@otlob.app',
        passwordHash: correctHash,
        isActive: true,
        isVerified: true,
      });

      await expect(
        service.login({ email: 'test@otlob.app', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for a deactivated account', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@otlob.app',
        passwordHash: correctHash,
        isActive: false,
        isVerified: true,
      });

      await expect(
        service.login({ email: 'test@otlob.app', password: 'correct-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws ForbiddenException with EMAIL_NOT_VERIFIED for an unverified account', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@otlob.app',
        passwordHash: correctHash,
        isActive: true,
        isVerified: false,
      });

      await expect(
        service.login({ email: 'test@otlob.app', password: 'correct-password' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }),
      });
      await expect(
        service.login({ email: 'test@otlob.app', password: 'correct-password' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns tokens for correct credentials on an active, verified account', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@otlob.app',
        passwordHash: correctHash,
        isActive: true,
        isVerified: true,
        role: 'USER',
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({ email: 'test@otlob.app', password: 'correct-password' });

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
    });
  });

  describe('verifyEmail', () => {
    it('throws BadRequestException when there is no active code', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@otlob.app', isVerified: false });
      prisma.verificationCode.findFirst.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ email: 'test@otlob.app', code: '123456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException for an expired code', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@otlob.app', isVerified: false });
      prisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-1',
        codeHash: await argon2.hash('123456'),
        attempts: 0,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.verifyEmail({ email: 'test@otlob.app', code: '123456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException and records an attempt for a wrong code', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@otlob.app', isVerified: false });
      prisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-1',
        codeHash: await argon2.hash('123456'),
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.verifyEmail({ email: 'test@otlob.app', code: '000000' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.verificationCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { attempts: { increment: 1 } },
      });
    });

    it('marks the user verified and returns tokens for a correct code', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@otlob.app',
        role: 'USER',
        isVerified: false,
        passwordHash: 'hashed',
      });
      prisma.verificationCode.findFirst.mockResolvedValue({
        id: 'code-1',
        codeHash: await argon2.hash('123456'),
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.verifyEmail({ email: 'test@otlob.app', code: '123456' });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.user.isVerified).toBe(true);
      expect(result.accessToken).toBe('signed-token');
    });
  });

  describe('refresh & logout (session invalidation)', () => {
    // Simulates a real row across the whole sequence — login/refresh/logout
    // in this test all read and write the *same* mutable object, the way
    // they'd all touch the same DB row in production. This is what actually
    // proves the property being tested: that logout makes a previously
    // valid refresh token stop working, not just that each method behaves
    // correctly in isolation.
    it('rejects a pre-logout refresh token after logout, and a fresh login/refresh cycle still works', async () => {
      const fakeUser = {
        id: 'user-1',
        email: 'test@otlob.app',
        role: 'USER',
        isActive: true,
        isVerified: true,
        passwordHash: await argon2.hash('correct-password'),
        refreshToken: null as string | null,
      };
      prisma.user.findUnique.mockImplementation(() => Promise.resolve({ ...fakeUser }));
      prisma.user.update.mockImplementation(({ data }: any) => {
        Object.assign(fakeUser, data);
        return Promise.resolve({ ...fakeUser });
      });

      // jwtService is mocked, so it doesn't actually encode the refresh
      // token string — sign a distinct opaque string per call and have
      // verifyAsync decode whichever one it's handed, so "old token" vs
      // "new token after rotation" are genuinely different values.
      let tokenCounter = 0;
      jwtService.signAsync.mockImplementation(() => Promise.resolve(`token-${++tokenCounter}`));
      jwtService.verifyAsync.mockImplementation((token: string) =>
        token.startsWith('token-')
          ? Promise.resolve({ sub: fakeUser.id, email: fakeUser.email, role: fakeUser.role })
          : Promise.reject(new Error('invalid')),
      );

      // 1. Login
      const loginResult = await service.login({ email: 'test@otlob.app', password: 'correct-password' });
      const originalRefreshToken = loginResult.refreshToken;
      expect(fakeUser.refreshToken).toBeTruthy();

      // 2. Refresh (rotates the stored token)
      const refreshResult = await service.refresh(originalRefreshToken);
      expect(refreshResult.refreshToken).not.toBe(originalRefreshToken);
      const rotatedRefreshToken = refreshResult.refreshToken;

      // 3. Logout
      await service.logout(fakeUser.id);
      expect(fakeUser.refreshToken).toBeNull();

      // 4. The most-recently-issued refresh token (still cryptographically
      // valid and unexpired) must now be rejected — this is the actual
      // security property in question.
      await expect(service.refresh(rotatedRefreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
      // The token from step 1 (already superseded by rotation) must also
      // still be rejected.
      await expect(service.refresh(originalRefreshToken)).rejects.toBeInstanceOf(UnauthorizedException);

      // 5. New login works normally after logout.
      const secondLogin = await service.login({ email: 'test@otlob.app', password: 'correct-password' });
      expect(secondLogin.accessToken).toBeTruthy();

      // 6. New refresh flow works normally with the new session's token.
      const secondRefresh = await service.refresh(secondLogin.refreshToken);
      expect(secondRefresh.accessToken).toBeTruthy();
    });
  });
});
