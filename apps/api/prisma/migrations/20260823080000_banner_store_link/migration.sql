-- Lets an admin attribute a homepage banner to the store it's promoting.
-- Nullable — existing platform/seasonal banners with no store keep working.

alter table public.banners
  add column if not exists store_id uuid references public.stores(id);

create index if not exists banners_store_id_idx on public.banners (store_id);
