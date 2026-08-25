-- Admin approval workflow for homepage-featured offers and merchant-created
-- ads, plus a per-store override for the monthly ad quota.
--
-- offers.product_id / is_featured_home / display_order already existed on
-- the live database (added directly via SQL outside migration history, and
-- never wired into Prisma or app code — an earlier, unfinished attempt at
-- featured offers). This migration formalizes them into the schema and
-- adds approval_status on top, instead of introducing a parallel concept.
-- Matches the hand-written SQL style already used in this repo's migrations
-- (no Prisma-generated migration engine).

create type "ApprovalStatus" as enum ('PENDING', 'APPROVED', 'REJECTED');

alter table public.offers
  add column if not exists product_id uuid references public.products(id),
  add column if not exists is_featured_home boolean not null default false,
  add column if not exists display_order integer not null default 0,
  add column if not exists approval_status "ApprovalStatus" not null default 'APPROVED',
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by_id uuid references public.users(id),
  add column if not exists reviewed_at timestamptz;

-- The homepage "Today's Offers" query filters on exactly this combination.
create index if not exists offers_featured_home_idx
  on public.offers (is_featured_home, approval_status, is_active);

alter table public.ads
  add column if not exists approval_status "ApprovalStatus" not null default 'PENDING',
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by_id uuid references public.users(id),
  add column if not exists reviewed_at timestamptz;

-- Grandfather in every ad that already existed before this feature shipped
-- — they were already live and displayed; don't silently pull them off the
-- homepage just because approval_status now defaults to PENDING for new rows.
update public.ads set approval_status = 'APPROVED';

create index if not exists ads_approval_status_idx on public.ads (approval_status);
create index if not exists ads_store_created_idx on public.ads (store_id, created_at);

-- Per-store override of the global "ad_monthly_limit_default" Setting row
-- (nullable = use the global default).
alter table public.stores
  add column if not exists monthly_ad_limit_override integer;
