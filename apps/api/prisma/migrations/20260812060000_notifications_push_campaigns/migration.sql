-- Extends notifications with a `type` category and a `data` deep-link
-- payload, adds push token storage (for Expo push delivery), and adds
-- admin-managed notification campaigns (promo/system/announcement sends
-- with simple targeting: all users, a role, a specific user, or a store's
-- past customers).

alter table public.notifications
  add column if not exists type text not null default 'SYSTEM',
  add column if not exists data jsonb;

create index if not exists notifications_user_id_idx on public.notifications (user_id);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  platform text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body_ar text not null,
  body_en text,
  type text not null default 'PROMO',
  target_type text not null,
  target_role text,
  target_user_id uuid references public.users(id),
  target_store_id uuid references public.stores(id),
  status text not null default 'DRAFT',
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

alter table public.notification_campaigns enable row level security;
