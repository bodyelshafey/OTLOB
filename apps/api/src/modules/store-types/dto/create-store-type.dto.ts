import { IsOptional, IsString } from 'class-validator';

export class CreateStoreTypeDto {
  @IsString()
  nameAr: string;

  @IsString()
  nameEn: string;

  @IsOptional()
  @IsString()
  image?: string;
}
