import { IsIn, IsString, MinLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(10)
  token: string;

  @IsIn(['ios', 'android'])
  platform: 'ios' | 'android';
}
