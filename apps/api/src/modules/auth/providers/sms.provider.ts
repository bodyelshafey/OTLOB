import { Logger } from '@nestjs/common';

// Abstraction so phone-OTP delivery isn't hard-wired to one SMS/WhatsApp
// vendor. Swap in a different provider by implementing this interface and
// wiring it up in the SMS_PROVIDER factory in auth.module.ts — nothing in
// OtpService or AuthService needs to change.
export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

// Default when no real provider is configured: logs the code instead of
// sending it, exactly like OtpService's SMTP fallback for email. Keeps the
// phone-verification flow fully testable end-to-end before a real SMS/
// WhatsApp vendor and its credentials are set up. Never used to fake a
// "verified" state — the user still has to read the code and submit it.
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(phone: string, message: string) {
    this.logger.warn(
      `SMS_PROVIDER not configured — message for ${phone}: ${message} (set SMS_PROVIDER=twilio + TWILIO_* env vars, or implement another SmsProvider, to send real SMS/WhatsApp)`,
    );
  }
}

// Real implementation via Twilio's REST API (plain HTTPS — no SDK
// dependency added). Only instantiated by the factory in auth.module.ts
// when SMS_PROVIDER=twilio and all three TWILIO_* env vars are present;
// otherwise ConsoleSmsProvider is used instead. Works for both SMS and
// WhatsApp — for WhatsApp, set TWILIO_FROM_NUMBER to a
// "whatsapp:+1415..." sender and pass phone numbers in the same
// "whatsapp:+20..." form.
export class TwilioSmsProvider implements SmsProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  async send(phone: string, message: string) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const body = new URLSearchParams({ To: phone, From: this.fromNumber, Body: message });
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`Twilio SMS send failed (${response.status}): ${text}`);
      // Deliberately generic — never surface carrier/provider error detail
      // to the HTTP caller.
      throw new Error('Failed to send SMS');
    }
  }
}
