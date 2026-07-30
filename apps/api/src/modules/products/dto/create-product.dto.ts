import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsUUID()
  storeId: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
