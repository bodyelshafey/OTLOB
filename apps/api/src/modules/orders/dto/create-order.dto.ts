import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateOrderDto {
  @IsUUID()
  storeId: string;

  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsString()
  customerName: string;

  @IsString()
  phone: string;

  @IsString()
  fullAddress: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
