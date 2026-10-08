import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as nodemailer from 'nodemailer';
import { SMS_PROVIDER } from './auth.constants';
import type { SmsProvider } from './providers/sms.provider';

// Generates and delivers verification codes for all three OTP purposes used
// across the auth flow (email verification, phone verification, password
// reset). Email delivery uses plain SMTP (works with any provider — Gmail,
// SendGrid, SES, Resend, etc. via their SMTP interface); phone delivery goes
// through the injected SmsProvider (see providers/sms.provider.ts). If
// neither is configured (e.g. local dev, or before the project has picked a
// vendor), both fall back to logging the code to the server console instead
// of failing — every flow still works end-to-end for testing, it just isn't
// actually delivered anywhere.
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(@Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
    }
  }

  // 6-digit numeric code, always zero-padded (e.g. "042917"). Uses
  // crypto.randomInt (CSPRNG) rather than Math.random(), which is not
  // safe for anything security-sensitive — its output is predictable
  // enough to make OTP brute-forcing meaningfully easier.
  generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private async sendEmail(to: string, subject: string, text: string, html: string) {
    if (!this.transporter) {
      // No SMTP configured yet — surface the code where a developer/tester
      // can actually see it, instead of silently discarding it.
      this.logger.warn(
        `SMTP not configured — email to ${to} not sent. Subject: "${subject}". Body: ${text} (set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS to send real emails)`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
  }

  async sendVerificationCode(email: string, fullName: string, code: string) {
    const subject = 'رمز تأكيد حسابك في OTLOB';
    const text = `مرحبًا ${fullName},\n\nرمز التحقق الخاص بك هو: ${code}\n\nصالح لمدة 10 دقائق. إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.`;
    const html = `
      <div style="font-family:sans-serif;direction:rtl;text-align:right;">
        <p>مرحبًا ${fullName}،</p>
        <p>رمز التحقق الخاص بك هو:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:6px;">${code}</p>
        <p>صالح لمدة 10 دقائق. إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
      </div>`;
    await this.sendEmail(email, subject, text, html);
  }

  async sendPasswordResetCode(email: string, fullName: string, code: string) {
    const subject = 'رمز إعادة تعيين كلمة المرور — OTLOB';
    const text = `مرحبًا ${fullName},\n\nرمز إعادة تعيين كلمة المرور الخاص بك هو: ${code}\n\nصالح لمدة 10 دقائق. إذا لم تطلب هذا، تجاهل هذه الرسالة — كلمة مرورك لن تتغير.`;
    const html = `
      <div style="font-family:sans-serif;direction:rtl;text-align:right;">
        <p>مرحبًا ${fullName}،</p>
        <p>رمز إعادة تعيين كلمة المرور الخاص بك هو:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:6px;">${code}</p>
        <p>صالح لمدة 10 دقائق. إذا لم تطلب هذا، تجاهل هذه الرسالة — كلمة مرورك لن تتغير.</p>
      </div>`;
    await this.sendEmail(email, subject, text, html);
  }

  async sendPhoneVerificationCode(phone: string, code: string) {
    const message = `رمز تأكيد رقم هاتفك في OTLOB هو: ${code} — صالح لمدة 10 دقائق.`;
    await this.smsProvider.send(phone, message);
  }
}
