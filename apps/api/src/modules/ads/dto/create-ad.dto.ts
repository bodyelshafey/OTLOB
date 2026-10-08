import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsSafeLink } from '../../../common/validators/safe-link.validator';

export class CreateAdDto {
  // A STORE_OWNER may only ever set this to their own store (enforced in
  // AdsService). Omitting it entirely means "platform-wide ad" and is
  // ADMIN/SUPER_ADMIN only.
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsSafeLink()
  link?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
