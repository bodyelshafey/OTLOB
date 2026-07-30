import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

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
}
