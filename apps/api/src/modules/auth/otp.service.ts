import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// Generates and delivers the 6-digit email verification code. Delivery uses
// plain SMTP (works with any provider — Gmail, SendGrid, SES, Resend, etc.
// via their SMTP interface) so this doesn't lock the project into one
// vendor. If SMTP env vars aren't set (e.g. local dev, or before the
// project has picked a provider), it falls back to logging the code to the
// server console instead of failing — the verification flow still works
// end-to-end for testing, it just isn't actually emailed anywhere.
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
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

  generateCode(): string {
    // 6-digit numeric code, always zero-padded (e.g. "042917").
    return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
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

    if (!this.transporter) {
      // No SMTP configured yet — surface the code where a developer/tester
      // can actually see it, instead of silently discarding it.
      this.logger.warn(
        `SMTP not configured — verification code for ${email} is: ${code} (set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS to send real emails)`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: email,
      subject,
      text,
      html,
    });
  }
}
