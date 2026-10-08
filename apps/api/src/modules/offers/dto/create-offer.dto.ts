import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateOfferDto {
  @IsUUID()
  storeId: string;

  @IsString()
  titleAr: string;

  @IsString()
  titleEn: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsNumber()
  oldPrice?: number;

  @IsOptional()
  @IsNumber()
  newPrice?: number;

  @IsOptional()
  @IsNumber()
  discountPercentage?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  // Store owner requests homepage placement by setting this. It does NOT
  // grant placement by itself — see OffersService.create/update, which
  // forces approvalStatus back to PENDING whenever this flips to true for
  // a non-admin caller. approvalStatus itself is never client-settable.
  @IsOptional()
  @IsBoolean()
  isFeaturedHome?: boolean;

  // Fully optional "detailed offer" section — a store owner can save a
  // valid offer with none of these filled in at all.
  @IsOptional()
  @IsString()
  includedItems?: string;

  @IsOptional()
  @IsString()
  conditions?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantityLimit?: number;
}
