-- This migration was already applied directly to the Supabase project via
-- the Supabase MCP connector during setup. This file exists so Prisma's
-- local migration history matches reality — after filling in apps/api/.env,
-- run:
--
--   npx prisma migrate resolve --applied 20260709120000_init
--
-- to mark it as applied WITHOUT re-running it (re-running would fail since
-- the tables already exist). Any schema changes after this point should go
-- through the normal `npx prisma migrate dev --name <change>` flow.

-- ENUMS ----------------------------------------------------------------
create type "UserRole" as enum ('USER', 'STORE_OWNER', 'EMPLOYEE', 'DRIVER', 'ADMIN', 'SUPER_ADMIN');
create type "StoreMemberRole" as enum ('OWNER', 'MANAGER', 'CASHIER');
create type "PaymentMethod" as enum ('CASH', 'CARD', 'WALLET');
create type "PaymentStatus" as enum ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
create type "OrderStatus" as enum ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED');
create type "DriverStatus" as enum ('OFFLINE', 'AVAILABLE', 'ON_DELIVERY');

-- IDENTITY ---------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text unique,
  password_hash text not null,
  avatar text,
  role "UserRole" not null default 'USER',
  is_active boolean not null default true,
  refresh_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id),
  vehicle_type text,
  plate_number text,
  status "DriverStatus" not null default 'OFFLINE',
  current_lat double precision,
  current_lng double precision,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- CATALOG ------------------------------------------------------------------
create table public.store_types (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  image text,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id),
  store_type_id uuid not null references public.store_types(id),
  name text not null,
  description text,
  image text,
  cover_image text,
  rating numeric(2,1) not null default 0,
  delivery_time text,
  delivery_fee numeric(10,2) not null default 0,
  minimum_order numeric(10,2) not null default 0,
  is_open boolean not null default true,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  user_id uuid not null references public.users(id),
  role "StoreMemberRole" not null default 'CASHIER',
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id),
  store_type_id uuid not null references public.store_types(id),
  name_ar text not null,
  name_en text not null,
  image text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  category_id uuid not null references public.categories(id),
  name text not null,
  description text,
  price numeric(10,2) not null,
  image text,
  is_available boolean not null default true,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  url text not null
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  title_ar text not null,
  title_en text not null,
  description_ar text,
  description_en text,
  image text,
  old_price numeric(10,2),
  new_price numeric(10,2),
  discount_percentage numeric(5,2),
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- LOCATION -------------------------------------------------------------
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null
);

create table public.districts (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id),
  name_ar text not null,
  name_en text not null
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id),
  delivery_fee numeric(10,2) not null default 0,
  is_active boolean not null default true
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  district_id uuid not null references public.districts(id),
  label text,
  full_address text not null,
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- CART -------------------------------------------------------------------
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  product_id uuid references public.products(id),
  offer_id uuid references public.offers(id),
  quantity integer not null default 1,
  note text,
  created_at timestamptz not null default now()
);

-- ORDERS -------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  store_id uuid not null references public.stores(id),
  driver_id uuid references public.drivers(id),
  address_id uuid references public.addresses(id),
  customer_name text not null,
  phone text not null,
  full_address text not null,
  payment_method "PaymentMethod" not null default 'CASH',
  payment_status "PaymentStatus" not null default 'PENDING',
  order_status "OrderStatus" not null default 'PENDING',
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  commission numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  coupon_id uuid,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid references public.products(id),
  offer_id uuid references public.offers(id),
  product_name text not null,
  product_image text,
  quantity integer not null default 1,
  price numeric(10,2) not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  status text not null,
  changed_by text,
  created_at timestamptz not null default now()
);

create table public.delivery_tracking (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  lat double precision,
  lng double precision,
  status text,
  updated_at timestamptz not null default now()
);

-- PAYMENTS -----------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  stripe_intent_id text,
  amount numeric(10,2) not null,
  status "PaymentStatus" not null default 'PENDING',
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  type text not null,
  amount numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table public.store_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id),
  commission_percentage numeric(5,2) not null default 10,
  minimum_order numeric(10,2) not null default 0
);

create table public.store_daily_stats (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  date date not null default current_date,
  orders_count integer not null default 0,
  revenue numeric(10,2) not null default 0,
  commission numeric(10,2) not null default 0,
  unique (store_id, date)
);

-- ENGAGEMENT ------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  store_id uuid not null references public.stores(id),
  order_id uuid unique references public.orders(id),
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  store_id uuid references public.stores(id),
  product_id uuid references public.products(id),
  created_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null,
  discount_value numeric(10,2) not null,
  max_uses integer,
  used_count integer not null default 0,
  min_order_value numeric(10,2),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  title_ar text,
  title_en text,
  body_ar text,
  body_en text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id),
  title text,
  image text,
  link text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  image text not null,
  link text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  day_of_week integer not null,
  open_time text not null,
  close_time text not null,
  is_closed boolean not null default false
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  action text not null,
  table_name text not null,
  record_id text,
  created_at timestamptz not null default now()
);

-- INDEXES ------------------------------------------------------------
create index on public.drivers (user_id);
create index on public.stores (owner_id);
create index on public.stores (store_type_id);
create index on public.store_members (store_id);
create index on public.store_members (user_id);
create index on public.categories (store_id);
create index on public.categories (store_type_id);
create index on public.products (store_id);
create index on public.products (category_id);
create index on public.product_images (product_id);
create index on public.offers (store_id);
create index on public.districts (zone_id);
create index on public.delivery_zones (zone_id);
create index on public.addresses (user_id);
create index on public.addresses (district_id);
create index on public.cart_items (user_id);
create index on public.cart_items (product_id);
create index on public.cart_items (offer_id);
create index on public.orders (user_id);
create index on public.orders (store_id);
create index on public.orders (driver_id);
create index on public.orders (address_id);
create index on public.order_items (order_id);
create index on public.order_items (product_id);
create index on public.order_items (offer_id);
create index on public.order_status_history (order_id);
create index on public.delivery_tracking (order_id);
create index on public.transactions (payment_id);
create index on public.store_daily_stats (store_id);
create index on public.reviews (user_id);
create index on public.reviews (store_id);
create index on public.favorites (user_id);
create index on public.favorites (store_id);
create index on public.favorites (product_id);
create index on public.notifications (user_id);
create index on public.ads (store_id);
create index on public.working_hours (store_id);
create index on public.audit_logs (user_id);

-- ROW LEVEL SECURITY ---------------------------------------------------
-- Enabled with ZERO policies on every table, on purpose: this blocks
-- Supabase's auto-generated PostgREST HTTP API (anon/authenticated roles)
-- from touching any of this data. Our NestJS backend connects with the
-- "postgres" role over a direct Postgres connection, which has BYPASSRLS,
-- so this has no effect on the backend — it only closes off the Supabase
-- REST API surface we don't want exposed.
alter table public.users enable row level security;
alter table public.drivers enable row level security;
alter table public.store_types enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.offers enable row level security;
alter table public.zones enable row level security;
alter table public.districts enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.delivery_tracking enable row level security;
alter table public.payments enable row level security;
alter table public.transactions enable row level security;
alter table public.store_settings enable row level security;
alter table public.store_daily_stats enable row level security;
alter table public.reviews enable row level security;
alter table public.favorites enable row level security;
alter table public.coupons enable row level security;
alter table public.notifications enable row level security;
alter table public.ads enable row level security;
alter table public.banners enable row level security;
alter table public.working_hours enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;
