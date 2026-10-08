import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsSafeLink } from '../../../common/validators/safe-link.validator';

export class CreateBannerDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  image!: string;

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

  // Optional — attributes the banner to the store it's promoting so the
  // storefront can show the store's name on the card.
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
