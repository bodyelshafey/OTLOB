import { IsOptional, IsUUID } from 'class-validator';

export class CreateFavoriteDto {
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;
}
