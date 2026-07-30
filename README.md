# OTLOB — Multi-Vendor Marketplace for New Administrative Capital

Monorepo: NestJS API (`apps/api`) + Next.js 15 frontend (`apps/web`), Postgres via Supabase (used as plain Postgres — see below), Redis via BullMQ, Socket.IO for realtime.

## How Supabase fits in (read this first)

This project uses **Supabase only as a managed Postgres database and file storage bucket.** It does **not** use Supabase Auth, the Supabase client SDK, or Row Level Security:

- **Auth**: entirely our own — JWT access/refresh tokens issued by the NestJS API, passwords hashed with Argon2. Account creation happens via `POST /auth/register`, not Supabase Auth.
- **Database access**: Prisma connects directly to Supabase's Postgres using a plain `DATABASE_URL` connection string. No Supabase client, no RLS policies — the NestJS API is the single authority over who can read/write what, enforced by `RolesGuard` on every endpoint.
- **File storage**: product/store images upload through our backend (`POST /upload/image`) to a Supabase Storage bucket using the **service role key**, server-side only. The frontend never talks to Supabase directly — it just renders whatever URL the backend gives it.

This keeps the "no logic in the frontend" requirement intact: the frontend is a pure view layer calling our API; our API is the only thing that talks to Supabase, in any capacity.

## One-time Supabase setup

**The database schema, RLS lockdown, and Storage buckets are already provisioned** on the connected Supabase project — every table, enum, and index from `apps/api/prisma/schema.prisma` was created directly, RLS is enabled with zero policies (see "Why RLS is on" below), leftover functions/tables from an earlier abandoned Supabase-native attempt were cleaned up, and `store_types` + `zones` + `districts` are seeded. Storage buckets `avatars`, `products`, `offers`, and `stores` already exist and are public. You don't need to run any of that yourself — just connect the app to it:

1. **Get your connection string.** Supabase Dashboard → your project → **Project Settings → Database → Connection string → URI**. Use the **direct connection on port 5432** (not the 6543 "Transaction pooler"). It looks like:
   ```
   postgresql://postgres:YOUR-PASSWORD@db.alfokhlyoitokzkahgce.supabase.co:5432/postgres
   ```
   If your password has special characters (`@ : / ? #` etc.), percent-encode them (e.g. `p@ss` → `p%40ss`).

2. **Get your Storage/service credentials.** Supabase Dashboard → **Project Settings → API**. You need:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key (**not** the `anon`/public key) → `SUPABASE_SERVICE_ROLE_KEY`

3. **Fill in `apps/api/.env`** (copy it from `apps/api/.env.example`) with the connection string and credentials from steps 1–2, plus your own `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (any long random string).

Then:

```bash
npm install
cd apps/api
npx prisma generate                                    # generates the Prisma Client types locally
npx prisma migrate resolve --applied 20260709120000_init  # marks the already-applied migration as synced (does NOT re-run it)
npm run prisma:seed                                     # idempotent — safe to run even though store types/zones are pre-seeded
```

After that, register your first account normally through the app, then have it promoted to `SUPER_ADMIN` directly in the database (ask whoever set up the Supabase connection, or run the SQL yourself in the Supabase SQL Editor):
```sql
update public.users set role = 'SUPER_ADMIN' where email = 'your@email.com';
```

### Why RLS is enabled with no policies

Supabase auto-exposes every `public` schema table over HTTP via PostgREST (the `anon`/`authenticated` REST API). RLS is the only thing gating that layer. Our NestJS backend connects with the `postgres` role over a **direct Postgres connection**, which has `BYPASSRLS` — so RLS has zero effect on the backend, but it fully locks out Supabase's REST API surface, which we don't want exposed at all (all authorization lives in `RolesGuard`, not Postgres policies). This project also had an event trigger (`ensure_rls`) that auto-enables RLS on any new table — that's a project-level safety net worth keeping, not something to fight.

## What's fully built and working

**Database** — complete Prisma schema covering every table in the technical reference (users, roles, stores, categories, products, offers, cart, orders, order items, payments, transactions, addresses, zones/districts, reviews, favorites, coupons, notifications, drivers, store members/employees, ads, banners, working hours, store settings, daily stats, audit logs), hosted on Supabase Postgres.

**Auth** — register/login/refresh/logout with JWT access + refresh tokens, Argon2 password hashing, role guard (`USER`, `STORE_OWNER`, `EMPLOYEE`, `DRIVER`, `ADMIN`, `SUPER_ADMIN`), rate-limited login/register endpoints.

**Core commerce flow, end to end** — store types → categories → products → cart (quantity merging) → checkout (single DB transaction: validates store is open, enforces minimum order, computes commission + delivery fee, creates the order, clears the cart) → order status state machine → reviews (auto-recalculates store rating) → favorites → coupons (validation logic) → addresses/zones/districts.

**File uploads** — `POST /upload/image` (multipart, `file` + optional `bucket` field — one of `avatars`/`products`/`offers`/`stores`, defaults to `products`) validates type (JPEG/PNG/WEBP/GIF) and size (5MB max), uploads to the matching Supabase Storage bucket, and returns a public URL to store on the relevant record.

**Realtime (Socket.IO)** — a `/realtime` namespace gateway with JWT-authenticated connections. Order status changes and new orders push live to the customer, the store's dashboard, and the driver, without polling. Driver location updates broadcast to whoever is tracking that order.

**Background jobs (BullMQ + Redis)** — a notifications queue (retryable, exponential backoff) and a daily-store-report queue that rolls up completed orders into `store_daily_stats` whenever an order completes.

**Rate limiting** — global default (120 req/min) via `@nestjs/throttler`, with stricter limits on `/auth/login` (8/min) and `/auth/register` (10/min).

**Dashboards (responsive — sidebar on desktop, tabs on mobile):**
- **Store owner** (`/dashboard/store`): overview with live stats, open/close toggle, product CRUD with category management, offers CRUD, order management with one-tap status transitions, employee management.
- **Driver** (`/dashboard/driver`): online/offline toggle, available-orders feed, active delivery banner, delivery history with earnings.
- **Admin** (`/dashboard/admin`): platform-wide stats, store directory, store-type management, paginated user directory, coupon management.
- All dashboard routes are client-guarded by role (UX only) *and* server-enforced via `RolesGuard` on every endpoint (the real security boundary).

**Customer app** — home, store listing + search, store details, cart, checkout, login/register, live order history, addresses, favorites, profile with a role-aware "Dashboard" entry point.

**Fully responsive** — mobile bottom nav / tablet+desktop top nav, dashboard sidebar on large screens, responsive grids everywhere (1 column on phones scaling up to 3–4 on desktop), centered forms on wide screens instead of stretching edge to edge.

**Arabic/English toggle** — `next-intl`, cookie-based, no URL prefix needed. Wired through the app shell + home page; deeper pages are still Arabic-only (see below).

**Tests** — unit tests for `AuthService` and `OrdersService` (checkout validation, commission math, the order status state machine). Run with `npm test --workspace=apps/api`.

**Design system** — Arabic-first RTL, brand palette (`#12bfe5` primary / `#eefcff` background / `#ff8a3d` accent), Cairo (display) + Tajawal (body) + IBM Plex Mono (prices/codes), consistent `rounded-xl2` cards with soft shadows across every screen.

## What's still intentionally out of scope

- **Full i18n coverage**: only the app shell + home page are translated; the pattern is established but not applied to all ~25 pages yet.
- **Automated e2e tests**: only unit tests for auth + checkout exist, no Supertest/e2e suite.
- **Redis caching layer**: Redis is used for BullMQ queues only; store/product reads hit Postgres directly.
- **Chat between customer/driver/store**: the realtime gateway's rooms are the groundwork; no chat UI or persistence yet.
- **Native push notifications**: in-app + realtime notifications work; no FCM/APNs integration.

## Getting started locally

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill environment variables (see "One-time Supabase setup" above)
#    IMPORTANT: the backend .env lives INSIDE apps/api, not the repo root —
#    that's where Prisma and NestJS both look for it by default.
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local

# 3. Start Redis (Postgres is Supabase, not local)
docker compose up -d redis

# 4. Sync Prisma with the already-provisioned Supabase schema and seed reference data
cd apps/api
npx prisma generate
npx prisma migrate resolve --applied 20260709120000_init
npm run prisma:seed

# 5. Run the test suite
npm test

# 6. Run both apps (from repo root, two terminals)
npm run dev:api    # http://localhost:4000/api  (Swagger at /api/docs)
npm run dev:web    # http://localhost:3000
```

To try the store-owner/driver/admin dashboards, register normally, then promote your user's `role` via Prisma Studio (`npx prisma studio`) or a direct SQL update, log in, and open Profile → "لوحة التحكم".

## Deploying

- **API**: any Node host (Railway, Render, Fly.io, or the provided `Dockerfile`). Set every variable from `apps/api/.env.example`, especially `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (long random strings) and the Supabase variables.
- For production, consider using Supabase's **connection pooler (port 6543)** as `DATABASE_URL` for runtime queries (add a separate `directUrl` in `schema.prisma`'s datasource block pointing at port 5432 for migrations) — this avoids exhausting Supabase's direct-connection limit under load. Not necessary for local development.
- **Web**: Vercel is the simplest path — set `NEXT_PUBLIC_API_URL` to your deployed API's `/api` URL.
- Run `npx prisma migrate deploy` (not `migrate dev`) against production.

## Security note

If you ever paste real API keys, database passwords, or connection strings into a chat, treat them as compromised and rotate them immediately from the Supabase dashboard — don't just remove them from the conversation.
#   O T L O B  
 #   O T L O B  
 