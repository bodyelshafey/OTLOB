import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  name: string;

  @IsUUID()
  storeTypeId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsString()
  deliveryTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrder?: number;
}
