import { IsOptional, IsString, IsUUID } from 'class-validator';

export class QueryStoreDto {
  @IsOptional()
  @IsUUID()
  storeTypeId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
