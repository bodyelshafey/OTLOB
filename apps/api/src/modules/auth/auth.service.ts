import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { OtpService } from './otp.service';

// How long a code stays valid, and the minimum gap between two sends —
// standard OTP hygiene (short-lived code, can't spam resend).
const OTP_TTL_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {}

  private async signTokens(userId: string, email: string, role: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, role },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  // Creates the account as unverified and emails a 6-digit code — no tokens
  // are issued yet. The client should route to a "verify your email" step
  // and call verifyEmail() to complete registration and receive tokens.
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
    });

    await this.issueVerificationCode(user.id, user.email, user.fullName);

    return {
      message: 'Verification code sent to your email',
      email: user.email,
      requiresVerification: true,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid email or password');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    if (!user.isVerified) {
      // A distinct, structured reason (not just a generic 401 string) so
      // the client can route straight to the verify-code screen instead of
      // showing a dead-end "wrong password" style error.
      throw new ForbiddenException({
        message: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    const { passwordHash: _, refreshToken: __, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  // Exchanges a valid code for tokens — this is how registration actually
  // completes (and is also how a not-yet-verified account recovers if they
  // abandoned the flow earlier and come back to try again).
  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('Invalid code');
    if (user.isVerified) {
      const tokens = await this.signTokens(user.id, user.email, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
      const { passwordHash: _, refreshToken: __, ...safeUser } = user;
      return { user: safeUser, ...tokens };
    }

    const record = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id, purpose: 'EMAIL_VERIFICATION', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('No active code — request a new one');
    if (record.expiresAt < new Date()) throw new BadRequestException('Code expired — request a new one');
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts — request a new code');
    }

    const valid = await argon2.verify(record.codeHash, dto.code);
    if (!valid) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid code');
    }

    await this.prisma.$transaction([
      this.prisma.verificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
      this.prisma.user.update({ where: { id: user.id }, data: { isVerified: true } }),
    ]);

    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    const { passwordHash: _, refreshToken: __, ...safeUser } = user;
    return { user: { ...safeUser, isVerified: true }, ...tokens };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Don't reveal whether the email exists — same response either way.
    if (!user || user.isVerified) {
      return { message: 'If an account needs verification, a new code was sent' };
    }

    const lastCode = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id, purpose: 'EMAIL_VERIFICATION' },
      orderBy: { createdAt: 'desc' },
    });
    if (lastCode) {
      const secondsSinceLast = (Date.now() - lastCode.createdAt.getTime()) / 1000;
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another code`,
        );
      }
    }

    await this.issueVerificationCode(user.id, user.email, user.fullName);
    return { message: 'If an account needs verification, a new code was sent' };
  }

  private async issueVerificationCode(userId: string, email: string, fullName: string) {
    const code = this.otpService.generateCode();
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    await this.prisma.verificationCode.create({
      data: { userId, codeHash, expiresAt, purpose: 'EMAIL_VERIFICATION' },
    });
    await this.otpService.sendVerificationCode(email, fullName, code);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string; role: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refreshToken) throw new UnauthorizedException('Access denied');

    const tokenMatches = await argon2.verify(user.refreshToken, refreshToken);
    if (!tokenMatches) throw new UnauthorizedException('Access denied');

    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Logged out successfully' };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashed = await argon2.hash(refreshToken);
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: hashed } });
  }
}
