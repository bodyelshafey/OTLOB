import { IsString, MinLength } from 'class-validator';

// PIVOTED 2026-09-13: phone is the primary login identity now, but a
// single `identifier` field (not two separate `phone`/`email` fields) is
// used deliberately — see AuthService.login for why: a couple of
// pre-existing accounts have no phone on file at all (from before this
// pivot) and can only ever log in by email, so the backend needs to accept
// either through one field rather than forcing the frontend to know which
// one applies to a given account. The frontend's login SCREEN still shows
// "Phone Number" as the primary/first field per the business requirement
// — this DTO just doesn't hard-code that assumption at the validation
// layer, since doing so would lock out those accounts entirely.
export class LoginDto {
  @IsString()
  @MinLength(3)
  identifier: string;

  @IsString()
  password: string;
}
