import { IsString, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

// PIVOTED 2026-09-13: phone is now the sole primary identity for
// registration — email is no longer collected here at all. It's added
// later, fully optionally, via the authenticated POST /auth/email/add
// (see auth.service.ts). Registration is a 2-step flow now: create
// account (phone+password) → verify phone OTP → done (tokens issued).
//
// The @Transform normalization below predates this pivot (added
// 2026-09-13, same day, earlier fix) — kept as-is, still needed for the
// same reason: a raw E.164-only regex rejects every format a real user
// actually types (local "01xxxxxxxxx", no country code, etc.), verified
// by running class-validator directly against these exact payloads.
export function normalizeEgyptianPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.startsWith('20')) return `+${digitsOnly}`;
  if (digitsOnly.startsWith('0')) return `+2${digitsOnly}`; // 01xxxxxxxxx -> +201xxxxxxxxx
  if (digitsOnly.length === 10) return `+20${digitsOnly}`; // 1xxxxxxxxx -> +201xxxxxxxxx
  return trimmed; // unrecognized shape — let @Matches reject it as-is
}

export class RegisterDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @Transform(({ value }) => normalizeEgyptianPhone(value))
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone must be in international format, e.g. +201234567890',
  })
  phone: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
