import { IsString } from 'class-validator';

export class GoogleLoginDto {
  // The ID token from Google Identity Services (web) or
  // expo-auth-session / Google Sign-In (mobile) — never the access token.
  // Verified server-side against GOOGLE_CLIENT_ID before being trusted.
  @IsString()
  idToken: string;
}
