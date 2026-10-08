import { IsEmail } from 'class-validator';

// The "Add your email" step (2026-09-13) — fully optional, authenticated
// (JWT), reached any time after registration, not a registration
// requirement. No OTP is sent here — the product decision for this phase
// is explicitly that email verification is NOT required (only phone is).
// The email-OTP infrastructure (VerifyEmailDto, OtpService, etc.) is left
// intact, not deleted, in case a future phase decides to require it here
// too — see AddEmailDto's sibling dto/verify-email.dto.ts.
export class AddEmailDto {
  @IsEmail()
  email: string;
}
