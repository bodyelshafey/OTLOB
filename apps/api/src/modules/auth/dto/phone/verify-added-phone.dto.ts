import { IsString, Length } from 'class-validator';

// Authenticated verify step for a phone added post-registration (JwtAuthGuard
// supplies the user id — see AuthController). Distinct route/DTO from the
// public VerifyPhoneDto used during registration to avoid ambiguity between
// "verify the phone I just registered with" and "verify a phone I'm adding
// to my already-authenticated account".
export class VerifyAddedPhoneDto {
  @IsString()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  code: string;
}
