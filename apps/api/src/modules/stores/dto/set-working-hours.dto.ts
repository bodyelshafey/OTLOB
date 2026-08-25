import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/; // "HH:mm", 24-hour

export class WorkingHourEntryDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday, matches Prisma schema

  @IsString()
  @Matches(TIME_PATTERN, { message: 'openTime must be in HH:mm format' })
  openTime: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'closeTime must be in HH:mm format' })
  closeTime: string;

  @IsBoolean()
  isClosed: boolean;
}

export class SetWorkingHoursDto {
  // Always the full week, replace-all — simplest semantics, and avoids the
  // ambiguity of a partial update leaving stale rows for untouched days.
  @IsArray()
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => WorkingHourEntryDto)
  days: WorkingHourEntryDto[];
}
