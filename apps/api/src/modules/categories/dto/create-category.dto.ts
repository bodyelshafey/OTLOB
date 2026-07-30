import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  nameAr: string;

  @IsString()
  nameEn: string;

  @IsUUID()
  storeTypeId: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsString()
  image?: string;
}
