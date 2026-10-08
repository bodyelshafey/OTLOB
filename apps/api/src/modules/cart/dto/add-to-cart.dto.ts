import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class AddToCartDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  offerId?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  note?: string;
}
