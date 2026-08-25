-- Optional richer offer information (all nullable — none of this is
-- required to create a valid offer), and category active/ordering support.

alter table public.offers
  add column if not exists included_items text,
  add column if not exists conditions text,
  add column if not exists quantity_limit integer;

alter table public.categories
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0;

create index if not exists categories_store_active_order_idx
  on public.categories (store_id, is_active, sort_order);
