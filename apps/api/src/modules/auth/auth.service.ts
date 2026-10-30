import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { promises as dns } from 'dns';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, normalizeEgyptianPhone } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { ResendPhoneCodeDto } from './dto/resend-phone-code.dto';
import { AddPhoneDto } from './dto/add-phone.dto';
import { VerifyAddedPhoneDto } from './dto/phone/verify-added-phone.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AddEmailDto } from './dto/add-email.dto';
import { OtpService } from './otp.service';
import { ConflictWithCodeException } from '../../common/exceptions/app.exceptions';

// How long a code stays valid, and the minimum gap between two sends —
// standard OTP hygiene (short-lived code, can't spam resend). Shared by
// all three OTP purposes (email verification, phone verification,
// password reset). Configurable via env so ops can tune without a
// redeploy of business logic.
const OTP_TTL_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES ?? 10);
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);

const PURPOSE_EMAIL_VERIFICATION = 'EMAIL_VERIFICATION';
const PURPOSE_PHONE_VERIFICATION = 'PHONE_VERIFICATION';
const PURPOSE_PASSWORD_RESET = 'PASSWORD_RESET';

// See AuthService.validateEmailDomain — this is the "is this a real,
// deliverable email address" safeguard that runs BEFORE we ever send an
// OTP to it (no point sending mail to a domain that can't receive it).
// It does not replace the OTP; both run.
const KNOWN_MAILBOX_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
]);
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'yopmail.com', 'throwawaymail.com', 'trashmail.com',
  'getnada.com', 'dispostable.com', 'fakeinbox.com', 'sharklasers.com',
  'maildrop.cc', 'mintemail.com', 'mohmal.com', 'moakt.com', 'guerrillamail.info',
  'discard.email', 'emailondeck.com', 'spamgourmet.com',
]);

// Thrown by login() when credentials are correct but the phone hasn't been
// verified yet. Kept as a plain object payload (not a generic 401) so the
// frontend can distinguish "wrong password" from "you need to verify your
// phone" and route accordingly, without leaking anything an
// unauthenticated caller with correct credentials shouldn't already know
// about their own account. PIVOTED 2026-09-13: email verification no
// longer gates login at all (email is optional now) — phone is the only
// mandatory check, so this no longer needs an emailVerified field.
class PhoneVerificationRequiredException extends ForbiddenException {
  constructor(phone: string | null) {
    super({
      code: 'PHONE_VERIFICATION_REQUIRED',
      message: 'Please verify your phone number to continue',
      phone,
    });
  }
}

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client | null = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpService: OtpService,
  ) {
    if (process.env.GOOGLE_CLIENT_ID) {
      this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }
  }

  private async signTokens(userId: string, email: string | null, role: string) {
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

  private sanitize(user: any) {
    const { passwordHash, refreshToken, ...safe } = user;
    return safe;
  }

  private async issueAuthResult(user: any, extra: Record<string, unknown> = {}) {
    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return { user: this.sanitize(user), ...tokens, ...extra };
  }

  // --- generic OTP helpers, shared by email verification / phone
  // verification / password reset ---------------------------------------

  private async issueCode(userId: string, purpose: string, deliver: (code: string) => Promise<void>) {
    const code = this.otpService.generateCode();
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    // A fresh code invalidates any still-active older code for the same
    // purpose, so at most one code can ever be successfully consumed per
    // purpose at a time (also caps DB growth from repeated resends).
    await this.prisma.$transaction([
      this.prisma.verificationCode.updateMany({
        where: { userId, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.verificationCode.create({ data: { userId, codeHash, expiresAt, purpose } }),
    ]);
    await deliver(code);
  }

  private async checkResendCooldown(userId: string, purpose: string) {
    const lastCode = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose },
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
  }

  // Validates a submitted code against the most recent unconsumed code for
  // (userId, purpose): checks existence, expiry, and attempt count,
  // increments attempts on a wrong guess, and — critically — consumes the
  // code with a single conditional UPDATE guarded by `consumedAt IS NULL`
  // rather than a separate check-then-update. If two requests race with the
  // same valid code, only one UPDATE can match (count === 1); the loser
  // gets count === 0 and a clear "already used" error instead of silently
  // succeeding twice. Returns the consumed record id on success — the
  // caller does whatever else the success should do (flip
  // emailVerified/phoneVerified, set a new password) in the same request,
  // but the code itself is already irreversibly spent by the time this
  // returns.
  private async validateAndConsumeCode(userId: string, purpose: string, code: string) {
    const record = await this.prisma.verificationCode.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('No active code — request a new one');
    if (record.expiresAt < new Date()) throw new BadRequestException('Code expired — request a new one');
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many attempts — request a new code');
    }

    const valid = await argon2.verify(record.codeHash, code);
    if (!valid) {
      await this.prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid code');
    }

    const consumed = await this.prisma.verificationCode.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) {
      // Someone else (a concurrent request with the same code) consumed it
      // between our SELECT and this UPDATE.
      throw new BadRequestException('This code was already used');
    }

    return record;
  }

  // --- registration / email verification ---------------------------------

  // See the DISPOSABLE_EMAIL_DOMAINS/KNOWN_MAILBOX_PROVIDERS comment above
  // for what this does and doesn't guarantee.
  private async validateEmailDomain(email: string) {
    if (process.env.SKIP_EMAIL_DOMAIN_CHECK === 'true') return;

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) throw new BadRequestException('Invalid email address');
    if (KNOWN_MAILBOX_PROVIDERS.has(domain)) return;
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      throw new BadRequestException('Disposable email addresses are not allowed');
    }

    let acceptsMail = false;
    try {
      const mx = await dns.resolveMx(domain);
      acceptsMail = mx.length > 0;
    } catch {
      // No MX record published — fall through to the A/AAAA fallback below
      // rather than failing immediately (a domain with no MX but a valid
      // A/AAAA record is still a legitimate mail destination per RFC 5321).
    }
    if (!acceptsMail) {
      const [a, aaaa] = await Promise.all([
        dns.resolve4(domain).catch(() => []),
        dns.resolve6(domain).catch(() => []),
      ]);
      acceptsMail = a.length > 0 || aaaa.length > 0;
    }

    if (!acceptsMail) {
      throw new BadRequestException('This email domain does not appear to accept mail');
    }
  }

  // Registration creates the account in a pending/unverified state and
  // fires off BOTH an email OTP and a phone OTP in parallel — no tokens are
  // issued here. The account only becomes usable once verifyEmail AND
  // verifyPhone have both succeeded (see login()'s gate below). This is a
  // deliberate product decision reinstated 2026-09-12 after a period where
  // verification was disabled entirely — see migration
  // 20260912100000_reintroduce_email_phone_verification.
  //
  // Concurrent registration with the same email/phone: the pre-checks below
  // close the obvious window, but the real guarantee is the DB unique
  // constraints on User.email/User.phone — a P2002 from the create() is
  // caught and turned into the same ConflictException a caller would get
  // from the pre-check, so two simultaneous requests for the same
  // email/phone can never both succeed.
  // Registration creates the account in a pending/unverified state and
  // fires off a phone OTP — no tokens are issued here. The account only
  // becomes usable once verifyPhone succeeds (see login()'s gate below).
  //
  // PIVOTED 2026-09-13: email is no longer collected at registration at
  // all — phone is now the sole primary identity, and email is added
  // later, fully optionally, via addEmail(). This replaces the 2026-09-12
  // "both email AND phone mandatory" design from one day earlier; see
  // migration 20260913090000_phone_first_auth_email_optional and the
  // schema.prisma comments on User.email/phone for the full history and
  // for why `phone` stays nullable at the DB level despite being required
  // here in the DTO (a couple of pre-existing accounts have none).
  //
  // Concurrent registration with the same phone: the pre-check below
  // closes the obvious window, but the real guarantee is the DB unique
  // constraint on User.phone — a P2002 from the create() is caught and
  // turned into the same structured error a caller would get from the
  // pre-check, so two simultaneous requests for the same phone can never
  // both succeed.
  async register(dto: RegisterDto) {
    const existingPhone = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existingPhone) {
      throw new ConflictWithCodeException(
        'PHONE_ALREADY_EXISTS',
        'An account already exists with this phone number.',
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          passwordHash,
        },
      });
    } catch (err: any) {
      // Duck-typed rather than `instanceof Prisma.PrismaClientKnownRequestError`
      // — Prisma error instances always carry a `.code` string like this
      // regardless of client version, and checking it directly avoids an
      // extra import surface for a single error-code check.
      if (err?.code === 'P2002') {
        throw new ConflictWithCodeException(
          'PHONE_ALREADY_EXISTS',
          'An account already exists with this phone number.',
        );
      }
      throw err;
    }

    await this.issueCode(user.id, PURPOSE_PHONE_VERIFICATION, (code) =>
      this.otpService.sendPhoneVerificationCode(user.phone!, code),
    );

    return {
      message: 'Account created — verify your phone number to continue',
      phone: user.phone,
      phoneVerified: false,
    };
  }

  // PIVOTED 2026-09-13: a single `identifier` field, matched against phone
  // first and email second — not two separate fields — because a couple of
  // pre-existing accounts (from before phone became the primary identity)
  // have no phone on file and can only log in by email. See LoginDto's
  // comment for the full reasoning; the frontend still presents "Phone
  // Number" as the primary/first field per the business requirement, this
  // is purely a backend lookup detail.
  // PIVOTED 2026-09-13, extended for Phase 6 same day: `identifier` is
  // tried as email (contains "@"), then phone, then — only if neither
  // matched — username. Cashier accounts (Phase 6) have no phone/email at
  // all, only a username, so this fallback is how they log in through the
  // same single endpoint everyone else uses; regular accounts never set
  // `username` so there's no ambiguity in practice.
  async login(dto: LoginDto) {
    const trimmed = dto.identifier.trim();
    const looksLikeEmail = trimmed.includes('@');
    let user = looksLikeEmail
      ? await this.prisma.user.findUnique({ where: { email: trimmed.toLowerCase() } })
      : null;
    if (!user && !looksLikeEmail) {
      // Registration stores phones normalized to E.164 (+201xxxxxxxxx), so a
      // user who typed "01xxxxxxxxx" at registration must be able to type
      // the same thing at login. Try the normalized form first, then the raw
      // value — a couple of legacy rows predate normalization and are stored
      // as typed. Sequential (not an `in` query) so that the known
      // duplicate-format legacy pair can never make the match ambiguous.
      const normalized = normalizeEgyptianPhone(trimmed);
      if (typeof normalized === 'string') {
        user = await this.prisma.user.findUnique({ where: { phone: normalized } });
      }
      if (!user && normalized !== trimmed) {
        user = await this.prisma.user.findUnique({ where: { phone: trimmed } });
      }
    }
    if (!user && !looksLikeEmail) {
      user = await this.prisma.user.findUnique({ where: { username: trimmed } });
    }

    // Same generic error whether the identifier doesn't match any account,
    // the password is wrong, or the account has no local password at all
    // (e.g. it was created via Google Sign-In) — none of that should be
    // distinguishable to an unauthenticated caller (user enumeration
    // protection).
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    // The ONLY mandatory verification gate now (see the pivot note on
    // `register` above) — email verification is never checked here.
    // Intentionally a 403 with a structured, distinguishable body (not the
    // generic 401 above) so the frontend can route the user back into
    // phone verification instead of just showing "wrong password".
    if (!user.phoneVerified) {
      throw new PhoneVerificationRequiredException(user.phone);
    }

    return this.issueAuthResult(user);
  }

  // Dormant as of the 2026-09-13 pivot — email is no longer part of
  // registration or login, so nothing calls this automatically anymore.
  // Left in place (not deleted) because it's still functionally correct
  // and could be wired back in if a future phase decides email should
  // (optionally) be verified too — see AddEmailDto's comment.
  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('Invalid code');

    if (!user.emailVerified) {
      await this.validateAndConsumeCode(user.id, PURPOSE_EMAIL_VERIFICATION, dto.code);
      await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }
    return { message: 'Email verified', emailVerified: true };
  }

  // Dormant as of the 2026-09-13 pivot — see verifyEmail above.
  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Don't reveal whether the email exists — same response either way.
    if (!user || user.emailVerified) {
      return { message: 'If an account needs verification, a new code was sent' };
    }

    await this.checkResendCooldown(user.id, PURPOSE_EMAIL_VERIFICATION);
    await this.issueCode(user.id, PURPOSE_EMAIL_VERIFICATION, (code) =>
      this.otpService.sendVerificationCode(user.email!, user.fullName, code),
    );
    return { message: 'If an account needs verification, a new code was sent' };
  }

  // Registration's ONLY verification step as of the 2026-09-13 pivot
  // (public, identified by `phone` — the account has no tokens yet at this
  // point). Was previously "step 2b" identified by email; switched to
  // phone since email is no longer collected at registration at all. On
  // success, issues tokens immediately — there's no second step to wait
  // for anymore.
  async verifyPhone(dto: VerifyPhoneDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) throw new BadRequestException('Invalid code');

    if (!user.phoneVerified) {
      await this.validateAndConsumeCode(user.id, PURPOSE_PHONE_VERIFICATION, dto.code);
      await this.prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
      user.phoneVerified = true;
    }

    return this.issueAuthResult(user);
  }

  async resendPhoneCode(dto: ResendPhoneCodeDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user || user.phoneVerified) {
      return { message: 'If an account needs verification, a new code was sent' };
    }

    await this.checkResendCooldown(user.id, PURPOSE_PHONE_VERIFICATION);
    await this.issueCode(user.id, PURPOSE_PHONE_VERIFICATION, (code) =>
      this.otpService.sendPhoneVerificationCode(user.phone!, code),
    );
    return { message: 'If an account needs verification, a new code was sent' };
  }

  // The optional "Add your email" step (2026-09-13) — authenticated (JWT),
  // reachable any time after registration (right after phone verification,
  // from a Skip-able screen, or from Profile settings later). No OTP is
  // sent — this phase's explicit product decision is that email
  // verification is NOT required, only phone is (see the pivot note on
  // `register`). Uniqueness is still enforced: two accounts can't share an
  // email even though email itself is optional.
  async addEmail(userId: string, dto: AddEmailDto) {
    await this.validateEmailDomain(dto.email);

    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, id: { not: userId } },
    });
    if (existing) {
      throw new ConflictWithCodeException('EMAIL_ALREADY_EXISTS', 'An account already exists with this email.');
    }

    let user;
    try {
      user = await this.prisma.user.update({ where: { id: userId }, data: { email: dto.email } });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictWithCodeException('EMAIL_ALREADY_EXISTS', 'An account already exists with this email.');
      }
      throw err;
    }

    return { message: 'Email saved', email: user.email };
  }

  // --- phone number add/change on an ALREADY-AUTHENTICATED account -------
  // (e.g. a Google Sign-In user completing their phone afterward, or any
  // fully-verified user changing their number later). Distinct from
  // verifyPhone/resendPhoneCode above, which run pre-auth during
  // registration — see the DTO comments for why the routes are split.

  async addPhone(userId: string, dto: AddPhoneDto) {
    const existing = await this.prisma.user.findFirst({
      where: { phone: dto.phone, id: { not: userId } },
    });
    if (existing) throw new ConflictException('This phone number is already in use');

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { phone: dto.phone, phoneVerified: false },
    });

    await this.issueCode(user.id, PURPOSE_PHONE_VERIFICATION, (code) =>
      this.otpService.sendPhoneVerificationCode(dto.phone, code),
    );

    return { message: 'Verification code sent to your phone', phone: dto.phone };
  }

  async verifyAddedPhone(userId: string, dto: VerifyAddedPhoneDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Invalid code');
    if (!user.phone) throw new BadRequestException('No phone number on file — add one first');
    if (user.phoneVerified) return { message: 'Phone already verified', phoneVerified: true };

    await this.validateAndConsumeCode(user.id, PURPOSE_PHONE_VERIFICATION, dto.code);
    await this.prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });

    return { message: 'Phone verified', phoneVerified: true };
  }

  async resendAddedPhoneCode(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Invalid request');
    if (!user.phone) throw new BadRequestException('No phone number on file — add one first');
    if (user.phoneVerified) return { message: 'Phone already verified' };

    await this.checkResendCooldown(user.id, PURPOSE_PHONE_VERIFICATION);
    await this.issueCode(user.id, PURPOSE_PHONE_VERIFICATION, (code) =>
      this.otpService.sendPhoneVerificationCode(user.phone!, code),
    );
    return { message: 'A new code was sent to your phone' };
  }

  // --- Google Sign-In ------------------------------------------------------

  // Verifies the ID token server-side (never trusts a client-asserted
  // email/sub) and either logs into an existing Google-linked account,
  // links Google to an existing local account with the same email, or
  // creates a brand-new account — never more than one account per email.
  // Google's own email verification is trusted in place of our email OTP
  // step, so these accounts start with emailVerified = true. Google does
  // NOT hand us a phone number, though, and the mandatory-verification
  // product rule doesn't have an explicit carve-out for OAuth signups — the
  // judgment call here is: block a legitimate Google login entirely with no
  // way to proceed would be worse than the alternative, so tokens ARE
  // issued with phoneVerified potentially still false, and the response
  // flags `phoneVerificationRequired: true` so the client can route the
  // user to add+verify a phone via /auth/phone/* right after. Revisit this
  // if the product decision is "no exceptions, even for OAuth."
  async googleAuth(dto: GoogleLoginDto) {
    if (!this.googleClient) {
      throw new BadRequestException('Google Sign-In is not configured on this server');
    }

    let payload: { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const p = ticket.getPayload();
      if (!p) throw new Error('empty payload');
      payload = p as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    let user = await this.prisma.user.findUnique({ where: { googleId: payload.sub } });

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email: payload.email } });
      if (existingByEmail) {
        // Same person, different login method — link instead of creating
        // a duplicate account.
        user = await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: { googleId: payload.sub, emailVerified: true },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            fullName: payload.name ?? payload.email.split('@')[0],
            email: payload.email,
            googleId: payload.sub,
            avatar: payload.picture,
            emailVerified: true,
            passwordHash: null,
          },
        });
      }
    }

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');

    return this.issueAuthResult(user, { phoneVerificationRequired: !user.phoneVerified });
  }

  // --- forgot / reset password ---------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Don't reveal whether the email exists, or whether it's a
    // Google-only account with no local password to reset — same
    // response either way.
    if (!user || !user.passwordHash) {
      return { message: 'If an account exists for this email, a reset code was sent' };
    }

    await this.checkResendCooldown(user.id, PURPOSE_PASSWORD_RESET);
    await this.issueCode(user.id, PURPOSE_PASSWORD_RESET, (code) =>
      this.otpService.sendPasswordResetCode(user.email!, user.fullName, code),
    );
    return { message: 'If an account exists for this email, a reset code was sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new BadRequestException('Invalid code');

    await this.validateAndConsumeCode(user.id, PURPOSE_PASSWORD_RESET, dto.code);
    const newPasswordHash = await argon2.hash(dto.newPassword);

    // Invalidate any existing session — a password reset is a security
    // event; every device gets logged out and has to sign in again.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash, refreshToken: null },
    });

    return { message: 'Password reset successful — please log in again' };
  }

  // --- tokens ----------------------------------------------------------------

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
