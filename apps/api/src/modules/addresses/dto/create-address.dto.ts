import { IsBoolean, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAddressDto {
  @IsUUID()
  districtId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fullAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
