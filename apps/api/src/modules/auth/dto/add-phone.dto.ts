import { IsString, Matches } from 'class-validator';

export class AddPhoneDto {
  // Require E.164 form (+<country code><number>, 8-15 digits total) so
  // storage/uniqueness/SMS delivery all operate on one normalized shape
  // instead of every caller inventing its own formatting.
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone must be in international format, e.g. +201234567890',
  })
  phone: string;
}
