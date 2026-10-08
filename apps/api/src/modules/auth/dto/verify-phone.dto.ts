import { IsString, Length } from 'class-validator';

// Public, pre-auth verification — the ONLY registration verification step
// as of the 2026-09-13 phone-first pivot (previously "step 2b", keyed by
// email; switched to phone since email is no longer collected at
// registration at all). Identified by `phone`, not a JWT, since the
// account has no tokens yet at this point. For verifying a phone added
// later on an already authenticated account (e.g. a Google Sign-In user),
// see dto/phone/verify-added-phone.dto.ts instead — that one runs behind
// JwtAuthGuard and needs no identifier.
export class VerifyPhoneDto {
  @IsString()
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  code: string;
}
