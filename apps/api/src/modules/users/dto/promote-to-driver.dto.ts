import { IsOptional, IsString } from 'class-validator';

export class PromoteToDriverDto {
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;
}
