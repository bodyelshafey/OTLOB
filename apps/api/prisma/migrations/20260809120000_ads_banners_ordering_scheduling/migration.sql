-- Adds ordering + optional start/end scheduling to ads and banners.
-- Needed for: admin control over ad display order, and optional
-- time-boxed advertisement scheduling (activation/deactivation window).
-- Matches the hand-written SQL style of 20260709120000_init (raw
-- create/alter, no Prisma-generated migration engine used for this repo).

alter table public.ads
  add column if not exists sort_order integer not null default 0,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

alter table public.banners
  add column if not exists sort_order integer not null default 0,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

create index if not exists ads_sort_order_idx on public.ads (sort_order);
create index if not exists banners_sort_order_idx on public.banners (sort_order);

-- Supports the new admin order-status filter (GET /orders?status=...).
create index if not exists orders_order_status_idx on public.orders (order_status);
