import { IsString } from 'class-validator';

// Public, pre-auth resend — identified by phone (2026-09-13 pivot; was
// email before email stopped being part of registration).
export class ResendPhoneCodeDto {
  @IsString()
  phone: string;
}
