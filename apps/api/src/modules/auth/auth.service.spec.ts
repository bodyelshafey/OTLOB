import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
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

    it('hashes the password and returns tokens on success', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        fullName: 'Test User',
        email: 'test@otlob.app',
        role: 'USER',
        passwordHash: 'hashed',
        refreshToken: null,
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.register({
        fullName: 'Test User',
        email: 'test@otlob.app',
        password: 'password123',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      const createArgs = prisma.user.create.mock.calls[0][0].data;
      // The plaintext password should never be persisted directly.
      expect(createArgs.passwordHash).not.toBe('password123');
      expect(result.accessToken).toBe('signed-token');
      expect(result.user).not.toHaveProperty('passwordHash');
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
      });

      await expect(
        service.login({ email: 'test@otlob.app', password: 'correct-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns tokens for correct credentials on an active account', async () => {
      const correctHash = await argon2.hash('correct-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@otlob.app',
        passwordHash: correctHash,
        isActive: true,
        role: 'USER',
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({ email: 'test@otlob.app', password: 'correct-password' });

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
    });
  });
});
