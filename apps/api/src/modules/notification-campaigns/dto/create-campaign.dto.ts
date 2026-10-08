import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

const TARGET_TYPES = ['ALL', 'ROLE', 'USER', 'STORE_CUSTOMERS'] as const;
// Mirrors the roles that actually make sense as a notification audience —
// deliberately excludes ADMIN/SUPER_ADMIN (an admin campaign target isn't
// "notify the other admins").
const TARGET_ROLES = ['USER', 'STORE_OWNER', 'DRIVER'] as const;
const NOTIFICATION_TYPES = ['PROMO', 'SYSTEM', 'ADMIN_ANNOUNCEMENT'] as const;

export class CreateNotificationCampaignDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  @MinLength(2)
  bodyAr: string;

  @IsOptional()
  @IsString()
  bodyEn?: string;

  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: (typeof NOTIFICATION_TYPES)[number];

  @IsIn(TARGET_TYPES)
  targetType: (typeof TARGET_TYPES)[number];

  @IsOptional()
  @IsIn(TARGET_ROLES)
  targetRole?: (typeof TARGET_ROLES)[number];

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsUUID()
  targetStoreId?: string;

  // If set, the campaign is queued as a delayed BullMQ job instead of
  // sending immediately — no separate cron/scheduler needed.
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
