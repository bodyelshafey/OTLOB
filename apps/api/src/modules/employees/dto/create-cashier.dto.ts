import { IsString, MinLength, Matches } from 'class-validator';

// Store-owner-driven cashier creation (Phase 6, 2026-09-13) — the owner
// picks the username and a temporary password directly; there is no
// self-registration path for cashiers at all (see
// EmployeesService.createCashier).
export class CreateCashierDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @Matches(/^[a-zA-Z0-9_.]{3,32}$/, {
    message: 'Username must be 3-32 characters: letters, numbers, underscore, or dot',
  })
  username: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
