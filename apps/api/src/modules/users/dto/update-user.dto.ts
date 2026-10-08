import { IsOptional, IsString, MinLength } from 'class-validator';

// Note: `phone` is intentionally NOT editable here. Changing a verified
// contact channel through a plain profile PATCH — with no uniqueness check
// or OTP confirmation — was a real gap (any user could claim any phone
// number). Phone changes now go through POST /auth/add-phone +
// POST /auth/verify-phone instead, which normalizes, checks uniqueness,
// and requires the new number to be verified again before it's trusted.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
