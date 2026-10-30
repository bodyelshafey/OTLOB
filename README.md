# OTLOB (أطلب) — Multi-Vendor Marketplace for New Administrative Capital

> **This file is the single source of truth for any AI assistant (or human) working on this repo.**
> It documents the architecture, data model, API surface, conventions, and current build status.
> **Maintenance rule: any time you (the AI) make a change that affects architecture, the data
> model, an API contract, an environment variable, build/deploy steps, or what's built vs. not
> built — update the relevant section of this file in the same session, before finishing the
> task.** Keep entries factual and concise. Never write real secrets, passwords, API keys, or
> connection strings into this file — describe *where* a credential lives and *how* to get it,
> never the value itself.

---

## 1. What this project is

OTLOB is a food/goods delivery marketplace (similar in shape to Talabat/Uber Eats) targeting
"العاصمة الإدارية الجديدة" (New Administrative Capital, Egypt). It's Arabic-first (RTL), with an
English toggle. Multiple store types (restaurants, pharmacies, groceries, etc.) list products,
customers order, drivers deliver, and admins run the platform.

Three client surfaces share one backend:

| App | Path | Stack | Status |
|---|---|---|---|
| Backend API | `apps/api` | NestJS 10 + Prisma 7 + PostgreSQL (Supabase) + Redis (BullMQ) + Socket.IO | Fully built |
| Web | `apps/web` | Next.js 15 (App Router) + React 19 + Tailwind + Zustand + React Query | Fully built (customer flow + all 3 dashboards) |
| Mobile | `apps/app` | Expo 57 (Expo Router) + React Native 0.86 + Zustand + React Query | Customer flow fully built; store-owner dashboard built; admin dashboard partial; driver dashboard still a stub |

It's an npm workspaces monorepo (`workspaces: ["apps/*", "packages/*"]`, no `packages/*` currently
populated). Node engine requirement: `>=22.0.0 <25`. React/React DOM are pinned to `19.2.3` across
all three apps via a root `overrides`.

---

## 2. Architecture & non-negotiable design rule

**All business logic and all data access live in the NestJS API. Both frontends (`web`, `app`) are
pure view layers that only call the API over HTTP/WebSocket.** Neither frontend talks to Supabase,
Postgres, or Redis directly. This is intentional and should not be violated when adding features —
new logic goes in `apps/api/src/modules/*`, not in a frontend `lib/` file.

```
                        ┌─────────────┐        ┌──────────────┐
                        │  apps/web   │        │   apps/app   │
                        │ (Next.js)   │        │ (Expo/RN)    │
                        └──────┬──────┘        └──────┬───────┘
                               │ HTTPS + WebSocket (Socket.IO)
                               ▼
                        ┌──────────────────────────────┐
                        │         apps/api              │
                        │  NestJS — REST + /realtime WS │
                        │  JWT auth, RolesGuard on      │
                        │  every protected endpoint     │
                        └───────┬───────────┬───────────┘
                                │           │
                     Prisma (pg)│           │ BullMQ
                                ▼           ▼
                    ┌────────────────┐  ┌─────────┐
                    │ Supabase        │  │  Redis  │  (queues only —
                    │ Postgres +      │  │         │   no caching layer)
                    │ Storage buckets │  └─────────┘
                    └────────────────┘
```

### How Supabase fits in (important — do not "helpfully" add Supabase Auth/RLS policies/client SDK to the frontend)

Supabase is used **only** as:
1. A managed **Postgres** database — Prisma connects directly via `DATABASE_URL`/`DIRECT_URL`. No Supabase client, no RLS-based authorization.
2. **Storage** for images — 4 public buckets: `avatars`, `products`, `offers`, `stores`. Only the API's `upload` module writes to them, using the **service role key**, server-side only.

Auth is 100% custom (NestJS + JWT + Argon2), not Supabase Auth. Row Level Security is enabled on
every table but with **zero policies** — this isn't a mistake, it's a deliberate lockdown of
Supabase's auto-generated PostgREST API (which would otherwise expose every table over HTTP to
anyone with the anon key). The API's own Postgres role connects directly and has `BYPASSRLS`, so
RLS has no effect on the backend; it only blocks the REST surface we don't want exposed. There's
also a project-level event trigger (`ensure_rls`) that auto-enables RLS on any newly created table
— keep it, don't disable it.

**Do not**: add `@supabase/supabase-js` usage to `apps/web` or `apps/app`, add RLS policies as a
substitute for `RolesGuard` checks, or have the frontend upload directly to Storage. All of that
routes through the API.

---

## 3. Current live infrastructure

*(Update this section whenever a deployment target changes — names, regions, plans, or connection
method. Never put an actual key/password/connection string here.)*

- **Supabase project**: `bodyelshafey's Project`, ref `alfokhlyoitokzkahgce`, region `eu-west-1`, Postgres 17. Used for the DB (via Prisma) and the 4 storage buckets described above.
- **Vercel project**: `otlob`, linked to GitHub `bodyelshafey/OTLOB`, framework auto-detected as Next.js, Node 24.x. Hosts `apps/web`. As of the last check, the latest production deployment was **canceled** and the project was not serving live traffic — check current status before assuming the web app is up.
- **API hosting**: designed for Railway (or any Node/Docker host) — see `apps/api/Dockerfile`. `apps/web/.env.local.example` points `NEXT_PUBLIC_API_URL` at a Railway URL by default; `apps/app/eas.json`'s `env` block does the same for EAS builds.
  - **Known failure mode (2026-10-24): mobile login shows `Application not found`.** That exact text is *not* produced by this
    API (every API error is `{ success:false, statusCode, message }` via `HttpExceptionFilter`, §8.12) — it is Railway's edge
    answering `{"status":"error","code":404,"message":"Application not found"}` for a domain that isn't attached to a running
    service. Web (`NEXT_PUBLIC_API_URL` on Vercel) and mobile (`eas.json`, `.env.local`) all point at the same Railway domain, so
    this is a Railway-side problem (service stopped/deleted/redeploy failed, or the public domain was removed/regenerated), not a
    client bug. It could **not** be verified from the repo/sandbox (no Railway access) — check the service + its public domain in
    the Railway dashboard; if the domain changed, update `NEXT_PUBLIC_API_URL` (Vercel), `apps/app/eas.json`, and
    `apps/app/app.json` `extra`. The mobile app now classifies this case (`apps/app/lib/apiError.ts`) instead of showing the raw text.
  - **Railway healthcheck:** set the service's Healthcheck Path to `/api/health/live` (dashboard setting — no `railway.json` in the repo).
  - **Dual environment (local + Railway) and mobile failover:** see [`docs/local-and-railway.md`](docs/local-and-railway.md) (added 2026-10-25).
- **Mobile**: Expo/EAS — see `apps/app/eas.json` for build profiles; not auto-deployed, built on demand via `eas build`.

---

## 4. Repo layout

```
apps/
  api/                  NestJS backend
    prisma/schema.prisma        the entire data model (source of truth for DB)
    prisma/migrations/          timestamped SQL migrations
    prisma/seed.ts               seeds store types + zones/districts
    src/modules/<name>/          one folder per domain module (controller+service+DTOs)
    src/common/                  guards, decorators, filters, interceptors, shared utils
    src/config/queue.config.ts   BullMQ concurrency settings
  web/                  Next.js 15 app (App Router)
    src/app/                    routes — see section 7
    src/components/             shared UI (Header, ProductCard, StoreCard, dashboard shell, decor)
    src/store/                  Zustand stores (auth, cart)
    src/lib/                    api client (axios), socket client, error helpers
    src/i18n/                   next-intl setup + ar.json/en.json
  app/                  Expo Router mobile app
    app/                        file-based routes — see section 7
    lib/, lib/endpoints/        axios client + typed endpoint functions per domain
    store/                      Zustand stores (auth, cart, settings)
    hooks/                      React Query hooks (catalog, orders, push notifications, online status)
    i18n/                       ar.json/en.json (i18n-js)
    components/, theme/         shared UI + design tokens
docker-compose.yml       local Redis + optional containerized api/web (Postgres is NOT local — it's Supabase)
load-tests/              k6 scripts (auth flow, checkout, public browse, staged capacity test)
```

---

## 5. Data model (Prisma — `apps/api/prisma/schema.prisma`)

Enums: `UserRole` (USER, STORE_OWNER, EMPLOYEE, DRIVER, ADMIN, SUPER_ADMIN), `StoreMemberRole`,
`PaymentMethod`, `PaymentStatus`, `OrderStatus`, `DriverStatus`, `ApprovalStatus`.

Models (39 total), grouped by domain:

- **Identity**: `User` (phone is now the primary identity, nullable at the DB level but required by
  `RegisterDto`; `email` is nullable/optional, added later — see §8; also nullable `passwordHash`,
  nullable unique `googleId`), `VerificationCode` (backs phone-OTP registration and email-based
  password reset — see §8), `Driver`
- **Catalog**: `StoreType`, `Store`, `StoreMember` (employees), `Category`, `Product`, `ProductImage`, `Offer`
- **Geography**: `Zone`, `District`, `DeliveryZone`
- **Ordering**: `Address`, `CartItem`, `Order`, `OrderItem`, `OrderStatusHistory`, `DeliveryTracking`
- **Money**: `Payment`, `Transaction`, `StoreSettings` (commission), `StoreDailyStat`
- **Engagement**: `Review`, `Favorite`, `Coupon`
- **Notifications**: `Notification`, `PushToken`, `PushDelivery`, `NotificationCampaign`
- **Marketing**: `Ad`, `Banner`
- **Ops**: `WorkingHour`, `Setting`, `AuditLog`

Migration history (chronological, in `apps/api/prisma/migrations/`): initial schema →
email-verification OTP → notifications/push campaigns → audit log metadata → push delivery
receipts → ads/banners ordering & scheduling → offer/ad approval workflow → offer details/category
ordering → banner-store link → auth rebuild #1 (`password_hash` made nullable, added
`phone_verified` and unique `google_id` to `User`,
`20260826120000_auth_google_phone_password_reset`) → verification removed
(`20260831010000_remove_account_verification`, dropped `is_verified`/`phone_verified` from `User`)
→ **verification reinstated as mandatory, 2026-09-12**
(`20260912100000_reintroduce_email_phone_verification` — re-adds `email_verified`/`phone_verified`
to `User` [renamed from the old `is_verified`], adds indexes on `role`/`is_active`/`drivers.status`
and a composite `verification_codes(user_id, purpose, consumed_at)` index; plus a follow-up
data-only migration `20260912100100_grandfather_existing_users_verification` that backfills
`emailVerified`/`phoneVerified` to `true` for every account that existed before this change — see
§8.3 for why that was necessary) → **pivoted to phone-first auth, 2026-09-13**
(`20260913090000_phone_first_auth_email_optional` — drops the `NOT NULL` constraint on `User.email`;
`phone` was already nullable at the DB level so no change was needed there — see §8 and the
`schema.prisma` comments on `User.email`/`User.phone` for the full reasoning, including a known
pre-existing phone-format collision between two accounts that was found but deliberately NOT
auto-fixed). All of the above were applied directly to the live Supabase Postgres via the
Supabase MCP tool and recorded in `_prisma_migrations` — no schema drift. **When you add a schema
change, create a new timestamped migration (`npx prisma migrate dev`) rather than editing an
applied one, and add a one-line entry to this list.**

---

## 6. Backend module map (`apps/api/src/modules`)

Every endpoint below other than `auth` is protected by JWT (`JwtAuthGuard`, global) and — where
noted — a role check (`@Roles(...)` + `RolesGuard`). Endpoints with no roles noted are open to any
authenticated user acting on their own data (or public where the module is inherently public, e.g.
browsing).

| Module | Base route | Notable endpoints | Roles enforced |
|---|---|---|---|
| auth | `/auth` | register (phone-only), verify-phone, resend-phone-code, login (phone-or-email `identifier`), google, `email/add`\*, phone/add\*, phone/verify\*, phone/resend\*, verify-email†, resend-verification†, forgot-password, reset-password, refresh, logout | register/verify-phone/resend-phone-code/login/google/verify-email/resend-verification/forgot-password/reset-password/refresh are public; \*email/add, phone/add, phone/verify, phone/resend and logout require JWT (own account); all rate-limited — see §6 Rate limiting below and §8. †verify-email/resend-verification are dormant (§8.8) — email is never verified in this phase |
| users | `/users` | me (get/patch — `phone` is NOT patchable here, see §8.6), list (server-side search by name/email/phone via `?search=`, 2026-09-13), get:id, toggle-active, role, `promote-to-driver` | ADMIN/SUPER_ADMIN for list/manage; role change is SUPER_ADMIN only; promote-to-driver is ADMIN/SUPER_ADMIN (refuses ADMIN/SUPER_ADMIN targets — see §8.10) |
| store-types | `/store-types` | CRUD | write = ADMIN/SUPER_ADMIN; read public |
| categories | `/categories` | CRUD, `mine` | write = STORE_OWNER/ADMIN/SUPER_ADMIN |
| stores | `/stores` | CRUD, `mine` (owner OR store-staff, §6 Phase 6), hours, toggle-open, commission | write = STORE_OWNER/ADMIN/SUPER_ADMIN; commission = ADMIN/SUPER_ADMIN only |
| products | `/products` | CRUD | write = STORE_OWNER/EMPLOYEE/ADMIN/SUPER_ADMIN |
| offers | `/offers` | CRUD, `mine`, `pending`, toggle-active, approve/reject | write = STORE_OWNER/ADMIN/SUPER_ADMIN; approve/reject = ADMIN/SUPER_ADMIN (approval workflow) |
| ads | `/ads` | CRUD, `mine`, `quota`, `pending`, monthly-limit setting, toggle-active, approve/reject | store owners create, admins approve/reject/set quota |
| ads (banners) | `/banners` | CRUD, toggle-active | ADMIN/SUPER_ADMIN only, incl. reading `all` |
| cart | `/cart` | get, add, update item, remove item, clear | owner-only, per user |
| addresses | `/addresses` | CRUD | owner-only |
| favorites | `/favorites` | list, add, remove | owner-only |
| orders | `/orders` | create, `me`, `store/:storeId`, list (admin), get:id, update status, `:id/issue` + `:id/issue/resolve` (Phase 7, cashier problem-flagging) | checkout logic lives in `orders.service.ts` — single DB transaction; store-scoped endpoints already correctly check the caller is that store's owner/staff or an admin (`assertStoreAccess`) |
| reviews | `/reviews` | `store/:storeId` (list), create | recalculates store rating on write |
| coupons | `/coupons` | CRUD, `validate/:code` | CRUD = ADMIN/SUPER_ADMIN; validate is used by checkout |
| drivers | `/drivers` | `GET me` (own profile/status — hydrates dashboard on load), `PATCH me` (update own vehicle info, update-only), status, location, `available-orders` (gated by own `AVAILABLE` status — see below), accept order (also requires `AVAILABLE`; sets `ON_DELIVERY` on success), `my-deliveries` | DRIVER role (location + available-orders also open to ADMIN/SUPER_ADMIN, unfiltered, for oversight). **No self-registration** — see §8.10; becoming a DRIVER is `PATCH /users/:id/promote-to-driver` only. **Availability gating fixed 2026-09-13**: `available-orders` used to show every READY order to every driver regardless of status; now an OFFLINE/ON_DELIVERY driver sees nothing (and `accept` rejects them too, not just the UI). `OrdersService.updateStatus` now flips the driver back to `AVAILABLE` when their delivery reaches `COMPLETED` — without this fix a driver's first-ever delivery would leave them permanently stuck `ON_DELIVERY` |
| employees | `/stores/:storeId/employees` | list, add (link an existing user), `cashiers` (Phase 6 — creates a brand-new username+password account directly), remove | STORE_OWNER/ADMIN/SUPER_ADMIN |
| payments | `/payments` | `intent` (Stripe), `cash-confirm` | owner-only |
| upload | `/upload/image` | multipart upload → Supabase Storage | any authenticated user; validates type (JPEG/PNG/WEBP/GIF) + size (5MB) |
| notifications | `/notifications` | list, mark read/read-all, push-token register/unregister | owner-only |
| notification-campaigns | `/admin/notification-campaigns` | CRUD, preview-audience, send | ADMIN/SUPER_ADMIN only |
| reports | `/reports` | store totals, store daily, platform totals, platform-by-store | STORE_OWNER (own store) / ADMIN/SUPER_ADMIN |
| audit-log | `/admin/audit-logs` | list | ADMIN/SUPER_ADMIN only |
| locations | `/zones`, `/districts` | list | public |
| jobs | (no controller) | BullMQ processors: `notifications.processor.ts`, `reports.processor.ts`, `delivery-automation.processor.ts` (Phase 8 — repeatable 2-hour auto-delivery scan, registered once at boot via `JobsService.onModuleInit`) | internal |
| realtime | `/realtime` (Socket.IO namespace) | see below | JWT-authenticated socket connections |

### Health endpoints (`apps/api/src/health.controller.ts` + `health.service.ts`, unauthenticated, exempt from the rate limiter)

- `GET /api/health/live` — liveness: process is up, touches nothing external (Railway healthcheck target).
- `GET /api/health/ready` — readiness: `200 {status:"ok", service:"otlob-api", runtime, checks:{database}}` or `503 {status:"unavailable"…}`.
  The DB check is a bounded `SELECT 1` (2 s timeout) cached 5 s (2 s when failing) and shared by concurrent callers. This is what the mobile app probes.
- `GET /api/health` — legacy contract kept unchanged (always 200, `status: ok|degraded`, `database`).
- No endpoint exposes connection strings or credentials (asserted in `src/health.spec.ts`).

### Realtime (Socket.IO, `/realtime` namespace)

**Per-instance state:** rooms live in each API process's memory (no `@socket.io/redis-adapter`). Two API instances (e.g. Railway + a
local dev API) do not share rooms or events — see `docs/local-and-railway.md`.


Client → server events: `order:subscribe`, `order:unsubscribe`, `store:subscribe`,
`driver:location`.
Server → client events: `order:status` (to `order:<id>`, `user:<id>`, and `store:<id>` rooms),
`driver:location` (to `order:<id>` room), `order:new` (to `store:<id>` room), `notification:new`
(to `user:<id>` room).

### Background jobs (BullMQ + Redis)

- **notifications queue** — retryable with exponential backoff; sends push (`expo-server-sdk`) and in-app notifications.
- **reports queue** — rolls a completed order up into `StoreDailyStat` daily aggregates.
- Concurrency is configured via `NOTIFICATIONS_QUEUE_CONCURRENCY` / `REPORTS_QUEUE_CONCURRENCY` env vars — see `apps/api/src/config/queue.config.ts`.
- **Startup-hang fix, 2026-09-26**: `JobsService.onModuleInit()` used to `await` the Phase 8
  repeatable-scan registration (`deliveryAutomationQueue.add(..., { repeat })`) directly. Nest calls
  every provider's `onModuleInit()` from *inside* `app.listen()`'s own internal `init()` — not
  before it — so an `onModuleInit()` that never settles means `app.listen()` never settles either:
  no error, no timeout, the HTTP server simply never binds. `queue.add()` needs a "ready" ioredis
  connection, and ioredis's default `retryStrategy` never gives up and never rejects — so an
  unreachable Redis, or one silently black-holed by a firewall/VPN (fails completely differently
  from a fast `ECONNREFUSED`), hung the *entire API* forever, with all routes already mapped and no
  error printed. Reproduced deterministically (Redis down → `app.listen()` never resolves; Redis up
  → resolves in ~40ms) and fixed by making the registration fire-and-forget with its own 10s timeout
  and exponential-backoff retry in the background (`registerAutoDeliverScanWithRetry` in
  `jobs.service.ts`) — a slow/unreachable Redis now only delays the auto-delivery scan itself, never
  the API's ability to start and serve requests. `PrismaService`'s `$connect()` had the same
  unbounded-wait shape (`pg.Pool` defaults to `connectionTimeoutMillis: 0`, i.e. wait forever); fixed
  with an explicit `connectionTimeoutMillis` (`DATABASE_CONNECT_TIMEOUT_MS`, default 15000) — but
  since the DB is not optional the way Redis is, that one fails fast (`process.exit(1)` with a clear
  error) rather than retrying in the background. `main.ts` also now binds `0.0.0.0` in production /
  `127.0.0.1` in development unless the `HOST` env var overrides it (was hardcoded to no explicit host) — unrelated to the actual hang
  (both explicit `0.0.0.0` and no host were already tried and both hung, since the real block was
  upstream of the `.listen()` call entirely), kept as the requested general hardening.

### Rate limiting

Global default 120 req/min (health endpoints are exempt via `@SkipThrottle()`) via `@nestjs/throttler`. Auth overrides (updated 2026-09-13 for the
phone-first pivot — see §8): `/auth/register` 5/min, `/auth/login` 8/min,
`/auth/google` 15/min, `/auth/refresh` 20/min, `/auth/verify-phone` 10/min,
`/auth/resend-phone-code` 5/min, `/auth/email/add` 5/min,
`/auth/phone/add` 5/min, `/auth/phone/verify` 10/min, `/auth/phone/resend` 5/min,
`/auth/forgot-password` 5/min, `/auth/reset-password` 10/min, plus the dormant
`/auth/verify-email` 10/min and `/auth/resend-verification` 5/min (§8.8). **Still per-instance
memory** (not Redis-backed) — fine for a single API instance, but won't hold the same effective
limit once the API is horizontally scaled to multiple instances (each instance enforces its own
counter). Flagged as a known gap, not yet fixed — see §13.

### Tests

**Added 2026-10-25:** `apps/api/src/health.spec.ts` (13 tests: bounded/cached DB check, 200/503 semantics, no secret leakage, throttler exemption proven
against a live `ThrottlerGuard`) and the mobile suite `apps/app/__tests__/*.test.js` (`npm run test:app`, plain `node --test`, 93 tests: endpoint
manager scenarios on a fake clock, config resolution, failure classification, health probe, the real `lib/api.ts` against scripted servers incl. token refresh
and never-replay-POST, the real `lib/socket.ts` against two real Socket.IO servers, and static release-config checks).

`apps/api/src/modules/auth/auth.service.spec.ts` (**rewritten again 2026-09-13** for the
phone-first pivot — the 2026-09-12 version tested "both email AND phone mandatory" and no longer
matched reality) and `apps/api/src/modules/orders/orders.service.spec.ts` — unit tests covering:
register (phone-only, structured `PHONE_ALREADY_EXISTS` on duplicate incl. a simulated
concurrent-registration P2002 race), login's phone-or-email identifier lookup and phone-only
verification gate (generic 401 vs. structured 403 `PHONE_VERIFICATION_REQUIRED` vs. success),
verifyPhone issuing tokens immediately (no second step), expired/wrong/attempt-exhausted codes,
**the required concurrency test** (two simultaneous verifications with the same valid code —
asserts exactly one succeeds, exactly one fails), resend cooldown/no-enumeration, addEmail
(saves directly, no OTP, structured `EMAIL_ALREADY_EXISTS` on duplicate), and Google Sign-In's
`phoneVerificationRequired` flagging. **Verified 2026-09-13 with `npx tsc --noEmit -p
tsconfig.json`**: zero type errors anywhere in `auth.service.ts`/its DTOs/this spec file, other
than the known Prisma-client-not-generated gap (see the sandbox note below) — this is a real,
executed check, not just a careful read. **Coverage gap, honestly**: this rewrite covers the
critical paths but not the full 20-item list a complete production auth test suite should have
(concurrent registration with real DB constraints under load, SMS/email provider failure handling,
verification-after-email/phone-change, full rate-limit integration tests, etc.) — treat as a solid
foundation, not exhaustive. Run with `npm test` from `apps/api` (or `npm test --workspace=apps/api`
from root). **No e2e/Supertest suite exists.**

> **Sandbox note (remove this paragraph once verified in a real environment):** confirmed again on
> 2026-09-13, fourth time now — `npx prisma generate` still fails because outbound access to
> `binaries.prisma.sh` is network-blocked in every AI sandbox that's worked on this project so far.
> `npm install` succeeds (registry access is available) and, as of this pass,
> **`npx tsc --noEmit -p tsconfig.json` was actually run and passed** with zero errors across
> `auth.service.ts`, its DTOs, and its spec file — the only errors reported anywhere are the
> expected "property does not exist on PrismaService" ones, which are exactly the
> generated-client gap, not a real defect. `jest` itself still fails at import time for the same
> underlying reason (`PrismaService extends PrismaClient`, and the ungenerated `@prisma/client`
> package has no real `PrismaClient` class/model delegates to satisfy ts-jest's runtime
> type-checking). So: **the test logic has now been statically type-checked and passed, but never
> actually executed** — a real step up from "written and reviewed" but still short of "ran and
> passed." Run `npx prisma generate && npm run build --workspace=apps/api && npm test
> --workspace=apps/api` in a normal environment (or CI) before deploying, and fix anything that
> surfaces.

---

## 7. Frontend routes

### Web (`apps/web/src/app`, Next.js App Router)

Public/customer: `/` (home), `/stores`, `/stores/[id]`, `/offers`, `/offers/[id]`, `/cart`,
`/checkout`, `/login`, `/register` (phone-only), `/register/verify-phone` (the sole registration
verification step), `/account/add-email` (optional, Skip-able — reached right after phone
verification, or later), `/account/add-phone` + `/account/verify-phone` (authenticated — Google
Sign-In completing a phone, or changing one later), `/forgot-password`, `/reset-password`,
`/profile`, `/profile/addresses`, `/profile/favorites`, `/profile/orders`. The old email-keyed
`/verify` route is dormant/unlinked (§8.8) — nothing routes to it anymore.

Dashboards (role-gated client-side via `RoleGate`/`DashboardShell`, and server-enforced by the
API's `RolesGuard`):
- `/dashboard/store` + `/products`, `/offers`, `/orders`, `/employees`, `/ads`
- `/dashboard/driver` + `/available`, `/deliveries`
- `/dashboard/admin` + `/users`, `/stores`, `/store-types`, `/orders`, `/offers`, `/ads`,
  `/banners`, `/coupons`, `/commission`, `/notifications`, `/audit-log`

### Mobile (`apps/app/app`, Expo Router, file-based)

`(auth)` group: `onboarding`, `login`, `register` (phone-only), `register-verify-phone` (the sole
registration verification step), `add-email` (optional, Skip-able), `add-phone` + `verify-phone`
(authenticated — Google Sign-In completing a phone, or changing one later), `forgot-password`,
`reset-password`. The old email-keyed `verify` screen is dormant/unlinked (§8.8).
`(tabs)` group: `index` (home), `stores`, `orders`, `favorites`, `profile`.
Stack screens: `store/[id]`, `offer/[id]`, `offers`, `cart`, `checkout`, `addresses`,
`order/[id]`, `notifications`, `profile/edit`, `profile/language`.
`dashboard/store.tsx` (fully built, 658 lines), `dashboard/admin.tsx` (partially built, 221
lines), `dashboard/driver.tsx` (**stub only**, 18 lines — needs the actual driver dashboard:
online/offline toggle, available-orders feed, active delivery, earnings history, matching the web
version at `/dashboard/driver`).

---

## 8. Auth flow (all clients)

Rebuilt four times now — history matters here for anyone reading the code cold:
1. First pass added phone verification, Google Sign-In, and forgot/reset password on top of the
   original register→email-OTP→login flow.
2. Second pass disabled email/phone OTP verification entirely (product decision — no
   SMS/WhatsApp/email-OTP provider dependency at the time).
3. Third pass (2026-09-12) reinstated mandatory email + phone verification — both required, in
   either order, no tokens until both done.
4. Fourth pass (**current state, 2026-09-13**) pivoted to **phone-first**: phone is now the sole
   primary identity for registration and login; email became a fully optional field, added later,
   never verified. This is the business rule driving everything below — see migration
   `20260913090000_phone_first_auth_email_optional` and the `schema.prisma` comments on
   `User.email`/`User.phone` for the full history. All logic lives in `apps/api/src/modules/auth/`
   — web and mobile are thin clients calling the same endpoints.

### 8.1 Register (2-step: account → phone OTP — no email at all)

`POST /auth/register` with `{ fullName, phone, password }` — **no email field**. Accepts common
Egyptian formats, not just strict E.164 — `RegisterDto`'s `@Transform` normalizes `01xxxxxxxxx`,
`1xxxxxxxxx`, and `201xxxxxxxxx` to `+201xxxxxxxxx` **before** the `@Matches` validator runs
(verified by running `class-validator` directly against these exact payloads, not guessed). Checks
phone uniqueness, hashes the password with Argon2, creates the `User` with `phoneVerified: false`,
sends a phone OTP, and returns `{ message, phone, phoneVerified: false }` — **no tokens**. A
duplicate phone returns a structured `409 { code: 'PHONE_ALREADY_EXISTS', message }`
(`ConflictWithCodeException`, `apps/api/src/common/exceptions/app.exceptions.ts`) — checked
up front AND caught again from a P2002 on `create()`, so a concurrent double-registration for the
same phone can never both succeed, and never surfaces as an unhandled 500.

### 8.2 Phone verification — the ONLY registration verification step

`POST /auth/verify-phone` `{ phone, code }` (public — identified by `phone`, not a JWT, since the
account has no tokens yet). Consumes the code **atomically** — a single conditional
`UPDATE ... WHERE consumed_at IS NULL` (`AuthService.validateAndConsumeCode`), not a separate
check-then-update — so if two requests race with the same valid code, only one can possibly
succeed. 5 wrong attempts invalidate the code; codes expire after `OTP_EXPIRES_MINUTES` (default
10); resend is cooled down by `OTP_RESEND_COOLDOWN_SECONDS` (default 60) via
`POST /auth/resend-phone-code` `{ phone }` (generic response, no enumeration). **Issues tokens
immediately on success** — there's no second step to wait for anymore (email isn't part of
registration at all).

**This is intentionally a different pair of routes from `/auth/phone/verify` and
`/auth/phone/resend`** (§8.6) — those are JWT-protected and used for adding/changing a phone on an
*already-authenticated* account (Google Sign-In users, or a verified user changing their number
later). A public route keyed by phone and an authenticated route keyed by JWT have genuinely
different trust models and shouldn't share a path.

### 8.3 Login — phone-or-email identifier

`POST /auth/login` `{ identifier, password }` → JWT access token (default 15m) + refresh token
(default 7d) **only if `phoneVerified`** — email verification is never checked at all (email is
optional, may not even exist). `identifier` is looked up as an **email if it contains `@`,
otherwise as a phone** (`AuthService.login`) — not two separate fields. This is deliberate: a
couple of pre-existing accounts (`admin@otlob.app`, one other) predate the phone-first pivot and
have no phone on file at all, so they can only ever log in by email; forcing a single "phone-only"
field would have permanently locked them out. **The login SCREEN still shows "Phone Number" as the
primary/first field per the business requirement** — this is purely a backend lookup detail, not
something the UI exposes.

Rejects with a generic 401 ("Invalid credentials", no user-enumeration) when: the identifier
doesn't match any account, the password is wrong, or the account has no local password at all (a
Google-only account — see 8.5). If credentials are correct but the phone isn't verified, returns
**403** with a structured body: `{ code: 'PHONE_VERIFICATION_REQUIRED', message, phone }`.

**Pre-existing accounts (from both the 2026-09-12 and 2026-09-13 migrations) were grandfathered
in** — every account that existed before 2026-09-12 had `phoneVerified` backfilled to `true`
(`20260912100100_grandfather_existing_users_verification`), so the phone-first pivot didn't
introduce a NEW lockout on top of the old one. Only registrations from 2026-09-12 onward go
through mandatory phone verification.

**Known pre-existing data quality issue (found 2026-09-13, not auto-fixed):** two accounts appear
to have the same real phone number stored in different raw formats (`01143677691` vs
`+201143677691`) — predates phone normalization, currently passes the unique constraint only
because the raw strings differ. Needs a human decision (merge/contact/ignore), not a silent
migration fix — see the `schema.prisma` comment on `User.phone`.

**Mobile login error handling (2026-10-24):** `apps/app/lib/apiError.ts#getApiErrorMessage` renders API errors as before, but
a 404/502/503/504 that does *not* have the API error shape (`statusCode` missing → came from a proxy/host, not from Nest) shows
`common.serviceUnavailable`, and a no-response failure shows `common.networkError` (both in `en.json`/`ar.json`). In `__DEV__`
both messages include the API URL being called. Currently wired into the login screen only.

### 8.4 The optional "Add your email" step

`POST /auth/email/add` `{ email }` (**JWT-protected**) — reachable any time after registration:
right after phone verification succeeds (onboarding, Skip-able — see `/account/add-email` web /
`(auth)/add-email` mobile), or later from profile settings. **No OTP is sent** — this phase's
explicit product decision is that email verification is NOT required, only phone is. Still
enforces uniqueness: a duplicate returns `409 { code: 'EMAIL_ALREADY_EXISTS', message }`. Skipping
is just "don't call this" — there's no forced follow-up.

### 8.5 Google Sign-In

`POST /auth/google` `{ idToken }` (public). The ID token comes from Google Identity Services (web)
or `expo-auth-session`'s Google provider (mobile) — **never trust a client-asserted email**, the
backend re-verifies the token's signature/audience server-side via `google-auth-library` against
`GOOGLE_CLIENT_ID` before touching the DB. Behavior:
- Existing `googleId` match → log in.
- No `googleId` match but an existing local account has the same (Google-verified) email → **link**
  (`User.googleId` set on that account) instead of creating a duplicate.
- No match at all → create a new `User` with `passwordHash: null`, `emailVerified: true` (Google
  already verified the email for us), `googleId` set, **no phone**.

Google never hands us a phone number, so a fresh/linked Google account may still have
`phoneVerified: false`. Tokens are issued regardless (blocking a legitimate Google login entirely
would be worse), and the response flags `phoneVerificationRequired: true` when phone isn't
verified yet — the client routes to `/account/add-phone` (web) / `(auth)/add-phone` (mobile) right
after login. This is now arguably even more central than before the phone-first pivot, since phone
is the platform's primary identity — worth revisiting whether Google accounts should eventually be
required to add a phone before full access, not just nudged.

A Google-only account (`passwordHash === null`) can never log in via `/auth/login` (see 8.3) and is
excluded from `/auth/forgot-password` (nothing to reset) — both return the same generic response.

### 8.6 Adding/changing a phone on an already-authenticated account

`POST /auth/phone/add` `{ phone }` (JWT) → sets the phone (unverified) and sends an OTP.
`POST /auth/phone/verify` `{ code }` (JWT) → verifies it. `POST /auth/phone/resend` (JWT) → resend.
Used today by the Google Sign-In post-login flow (§8.5); also the general-purpose "change my phone
number" path for any already-verified account. **Not** the same routes as the public
registration-time `/auth/verify-phone`/`/auth/resend-phone-code` (§8.2) — see that section for why.

### 8.7 Forgot / reset password

Only meaningful for accounts that have an email (most don't, right after registration, until they
go through §8.4). `POST /auth/forgot-password` `{ email }` → always returns the same generic
message regardless of whether the email exists, belongs to a Google-only account, or the account
simply has no email at all (no enumeration); sends a 6-digit code by email when it's a real
local-password account with an email on file. `POST /auth/reset-password`
`{ email, code, newPassword }` verifies the code, sets the new password, and — since a password
reset is a security event — **invalidates the stored refresh token**, signing the account out on
every device. **A phone-only account with no email has no password-reset path at all right now** —
flagged as a gap, not fixed in this pass (would need an SMS-based reset flow).

### 8.8 OTP infrastructure (shared across purposes — email-verification code kept, not deleted)

`VerifyEmailDto`/`ResendVerificationDto` and `AuthService.verifyEmail`/`resendVerification` are
**dormant as of the 2026-09-13 pivot** — nothing calls them automatically anymore, since email
verification was explicitly decided against for this phase (§8.4). Left in place, not deleted, in
case a future phase decides the optional email should (optionally) be verified too.
`VerifyPhoneDto`/`ResendPhoneCodeDto`/`AddPhoneDto`/`dto/phone/verify-added-phone.dto.ts`,
`OtpService`, and `providers/sms.provider.ts` back the (still very much live) phone-OTP and
password-reset paths, sharing one `VerificationCode` table and one code path in `AuthService`
(`issueCode`/`validateAndConsumeCode`/`checkResendCooldown`). Codes are 6 digits from
`crypto.randomInt` (not `Math.random()`), hashed with Argon2 before storage, expire after
`OTP_EXPIRES_MINUTES` (default 10), allow `OTP_MAX_ATTEMPTS` wrong guesses (default 5), enforce an
`OTP_RESEND_COOLDOWN_SECONDS` resend cooldown (default 60), and are consumed via a single atomic
conditional `UPDATE`.

- **Email delivery** (`apps/api/src/modules/auth/otp.service.ts`): plain SMTP via `nodemailer`.
  Only exercised today by forgot/reset-password (§8.7) for accounts that have an email — falls
  back to logging the code server-side if `SMTP_*` vars aren't set.
- **SMS/WhatsApp delivery** (`apps/api/src/modules/auth/providers/sms.provider.ts`): an
  `SmsProvider` interface, picked by a factory in `auth.module.ts`. Ships with `ConsoleSmsProvider`
  (logs the code — the default) and `TwilioSmsProvider` (real delivery, activates when
  `SMS_PROVIDER=twilio` + the three `TWILIO_*` vars are set). **No Twilio/vendor credentials exist
  for this project yet** — until they're set, every phone OTP (now the ONLY registration
  verification step) only reaches the server console log, which means registration is not
  actually usable by real users in production yet. Setting up a real SMS provider remains the
  single most urgent remaining item.

### 8.9 Tokens (unchanged)

Both frontends store tokens (web: Zustand + persisted storage; mobile: `expo-secure-store`) and
attach the access token as a Bearer header via an axios interceptor. On 401 the interceptor calls
`POST /auth/refresh` and retries once. `POST /auth/logout` invalidates the refresh token
(`onSettled`-based on both clients — clears local session state regardless of whether the API call
itself succeeds, so an already-expired/missing access token never leaves the user stuck). Passwords
are hashed with Argon2, minimum length 8 characters. Promoting a user to `STORE_OWNER`/`ADMIN`
still happens via `PATCH /users/:id/role` (SUPER_ADMIN only) or a direct DB update. **Promoting to
`DRIVER` no longer goes through that generic role-change endpoint** — see §8.10.

### 8.10 Driver promotion (security fix, 2026-09-12 — was self-service, now admin-only)

`POST /drivers/register` **used to let any authenticated user create their own Driver profile —
there was no `@Roles` guard on it at all.** That endpoint is gone. The only way to become a
`DRIVER` now:

`PATCH /users/:id/promote-to-driver` `{ vehicleType?, plateNumber? }` — **ADMIN/SUPER_ADMIN only**
(`RolesGuard`). In one DB transaction: sets `role: DRIVER`, upserts the `Driver` row
(`isApproved: true`), and writes an `AuditLog` entry (`USER_PROMOTED_TO_DRIVER`). Refuses to
promote an ADMIN/SUPER_ADMIN account, and refuses if the target is already a driver.

Drivers can still update their own vehicle info via `PATCH /drivers/me` (`@Roles(DRIVER)`,
update-only — no upsert, so it can't recreate the old self-registration hole).

**Admin UI built 2026-09-13**: `/dashboard/admin/users` now has server-side search (name/email/
phone) and an "إضافة كمندوب" action with a confirm dialog, wired to this endpoint.

### 8.11 Rate limiting

See §6's Rate limiting section for the current per-route limits (they cover both the public
registration-time OTP routes and the authenticated post-login phone routes).

### 8.12 Structured API errors

As of 2026-09-13, duplicate/conflict errors project-wide use a shared shape via
`apps/api/src/common/exceptions/app.exceptions.ts` (`ConflictWithCodeException`,
`ForbiddenWithCodeException`): `{ statusCode, code, message }`, e.g.
`{ statusCode: 409, code: 'PHONE_ALREADY_EXISTS', message: '...' }`. **Frontends should switch on
`code`, never parse `message`** — `message` can be reworded without that being a breaking API
change. Currently used by register (`PHONE_ALREADY_EXISTS`) and addEmail
(`EMAIL_ALREADY_EXISTS`); login's `PHONE_VERIFICATION_REQUIRED` (403) follows the same pattern
inline rather than through the shared helper (predates it slightly, same shape). Extend this
pattern to new duplicate/permission errors rather than throwing bare `ConflictException`/
`ForbiddenException` with just a message string.

**Error body contract (global filter, `apps/api/src/common/filters/`)** — flattened 2026-10-20.
Every error is `{ success: false, statusCode, path, timestamp, message, code?, ...extras }` where
`message` is **always a string (or `string[]` for validation errors), never an object**, and `code`
plus any extra fields a coded exception carries (e.g. `phone` on `PHONE_VERIFICATION_REQUIRED`) are
**top-level**. Before this change the whole Nest response was nested under `message`, so clients that
read `body.code`/`body.phone` never found them and mobile rendered the `message` object as a React
child (crash on duplicate-phone registration). Prisma errors are mapped deliberately by
`prisma-error.mapper.ts`: `P2002`→409 (`PHONE_/EMAIL_/USERNAME_ALREADY_EXISTS` or `ALREADY_EXISTS`),
`P2025`→404, `P2003`→409, `P2000/P2011/P2012…`→400, `P2024/P1001/P1002/P1008/P1017`/initialization
→503 `SERVICE_UNAVAILABLE`, anything else→generic 500. Raw SQL/stack traces are only logged
server-side. Address endpoints now validate `:id` with `ParseUUIDPipe` (400) and `PATCH` uses a real
`UpdateAddressDto` (a `Partial<>` type is erased at runtime and previously skipped validation).
Login now tries the E.164-normalized phone first, then the raw value (legacy rows).

**Pending migration (not applied to production):** `20261010090000_order_address_on_delete_set_null`
— the live `orders_address_id_fkey` is `NO ACTION`, so deleting an address used by any order fails;
until applied, `DELETE /addresses/:id` returns 409 `ADDRESS_IN_USE`. Mobile `orders`/`addresses`
screens now render an `ErrorState` with retry on failed requests instead of the empty state.

### 8.13 Sensitive-operations audit (what does and doesn't have step-up protection)

- **Change email**: goes through `/auth/email/add` (§8.4) — no OTP, since email isn't a security
  boundary in this design (phone is). Uniqueness is still enforced.
- **Change password while logged in**: no such endpoint exists — the only way to change a password
  today is the OTP-based forgot/reset-password flow (§8.7), which only works for accounts with an
  email (see the gap noted there).
- **Change phone**: goes through `/auth/phone/add` + `/auth/phone/verify` (§8.6, JWT-protected,
  requires a fresh OTP) — `PATCH /users/me` cannot touch `phone` at all.
- **Financial operations**: no restaurant-payout or fund-withdrawal endpoints exist anywhere in
  `apps/api/src/modules` (confirmed by search). `PATCH /stores/:id/commission` is the only
  money-adjacent write and is already `ADMIN`/`SUPER_ADMIN`-only via `RolesGuard`.


---

## 9. Environment variables (names & purpose only — never fill in real values here)

`AUTO_DELIVER_AFTER_MINUTES` (default 120 — the Phase 8 2-hour auto-delivery cutoff, §6/jobs
module), `AUTO_DELIVER_SCAN_INTERVAL_MINUTES` (default 10 — how often the scan job runs),
`DELIVERY_AUTOMATION_QUEUE_CONCURRENCY` (default 1), `DATABASE_CONNECT_TIMEOUT_MS` (default 15000
— added 2026-09-26 as part of the startup-hang fix; how long `PrismaService.onModuleInit()` waits
for the initial DB connection before failing fast — see the "Startup-hang fix" note under
§6/Background jobs). See the jobs/drivers/orders rows in §6's module map for how these fit together.

**Startup validation (added 2026-09-27)**: `main.ts` calls `assertRequiredEnv()` before creating the
Nest app. `DATABASE_URL`, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are required — if any is
missing/blank the process exits immediately with a clear message naming the variable (never its
value), instead of failing later on the first login/query. With `NODE_ENV=production` it also refuses to
start if either JWT secret still starts with `change_me` (the `.env.example` placeholder). `REDIS_URL`
is deliberately *not* required (falls back to `redis://localhost:6379`; Redis problems never block
startup — see §6/Background jobs). Never point a checked-in/shared `.env` at a throwaway local
database for testing: a `localhost` `DATABASE_URL` left behind in `apps/api/.env` makes the API fail
fast at boot (`PrismaService` exits on connect failure) on any machine without that database.

**Known migration-history gap (found 2026-09-27)**: the live database has
`20260831010000_remove_account_verification` recorded in `_prisma_migrations`, but that migration
folder is not in `apps/api/prisma/migrations/`. The live `users` table still matches `schema.prisma`
exactly (verified column-by-column), so runtime is unaffected, but `prisma migrate deploy`/`migrate dev`
will complain about an applied migration missing locally until the folder is restored (from git
history, or recreated as the net-zero no-op the later `reintroduce_email_phone_verification`
migration implies). Do not "fix" it by resetting the database.

### `apps/api/.env` (copy from `.env.example`)
`DATABASE_URL` (Supabase Supavisor transaction pooler, port 6543, `?pgbouncer=true`), `DIRECT_URL`
(Supabase direct connection, port 5432, used only by Prisma CLI for migrations), `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SMTP_HOST`/`PORT`/`USER`/`PASS`/`FROM` (email delivery — **only used
by forgot/reset-password now (§8.7), and only for accounts that have an email; NOT part of
registration at all as of the 2026-09-13 phone-first pivot** — optional, console-log fallback),
`SMS_PROVIDER`/`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM_NUMBER` (**the ONLY
registration-critical delivery path now, see §8.2/§8.8** — no vendor account configured yet, so
phone OTPs only reach the server console log until these are set; this is the single most urgent
remaining item, see §13), `OTP_EXPIRES_MINUTES` (default 10), `OTP_RESEND_COOLDOWN_SECONDS`
(default 60), `OTP_MAX_ATTEMPTS` (default 5) — tune without a redeploy of business logic,
`SKIP_EMAIL_DOMAIN_CHECK` (default `false` — an anti-fake-email safeguard for the optional
"Add your email" step, §8.4; dormant if that step's `validateEmailDomain` call is skipped),
`GOOGLE_CLIENT_ID` (server-side Google OAuth client ID
used to verify ID tokens for `POST /auth/google` — see §8.5; `/auth/google` returns 400 if unset),
`SENTRY_DSN` (optional), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `REDIS_URL`,
`NOTIFICATIONS_QUEUE_CONCURRENCY`, `REPORTS_QUEUE_CONCURRENCY`, `PORT`, `CORS_ORIGIN`.

#### Verification-related env vars — current status (updated 2026-09-13)

Phone is the sole mandatory-verification identity now (§8) — email is optional and never
verified. This table replaces the 2026-09-12 version, since the phone-first pivot changed which
vars are actually on the critical path:

| Variable | Status | Why |
|---|---|---|
| `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | **USED — the ONLY registration-critical delivery path, but not actually configured** | Registration's phone OTP (§8.2) — the sole verification step — depends on this. **No vendor account exists for this project** — until these are set, phone codes only reach the server console log, meaning real users cannot complete registration in production right now. Setting this up is the top remaining item — see §13. |
| `SMTP_HOST`/`PORT`/`USER`/`PASS`/`FROM` | **USED, but no longer registration-critical** | Only forgot/reset-password (§8.7) depends on this now, and only for accounts that have an email (see the gap noted there for phone-only accounts). |
| `OTP_EXPIRES_MINUTES`, `OTP_RESEND_COOLDOWN_SECONDS`, `OTP_MAX_ATTEMPTS` | **USED** | Tune OTP TTL / resend cooldown / brute-force attempt limit (§8.8) without touching code. |
| `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` | **USED** | Google Sign-In (§8.5) — independent of the OTP flow. |
| `SKIP_EMAIL_DOMAIN_CHECK` | **USED, lower stakes than before** | Now only guards the optional "Add your email" step (§8.4), not registration itself. |

`AUTO_DELIVER_SCAN_ENABLED` (optional; `false` stops this instance from scheduling the 2-hour order auto-delivery scan — set it on any
non-production instance that shares the production database, e.g. a local API; unset = enabled).

`HOST` (optional — interface to bind; unset = `0.0.0.0` in production, `127.0.0.1` otherwise. Set `HOST=0.0.0.0` in
`apps/api/.env` to reach a local API from an Android emulator or a physical device; never needed on Railway.)

### `apps/web/.env.local` (copy from `.env.local.example`)
`NEXT_PUBLIC_API_URL` (must be https in production, must include the `/api` prefix),
`NEXT_PUBLIC_GOOGLE_MAPS_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Google Sign-In — public by design,
loaded client-side by `GoogleSignInButton.tsx`; a *different* Google Cloud OAuth client than
`apps/api`'s `GOOGLE_CLIENT_ID`, see §8.3), `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`,
`SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (CI source-map upload only).

### `apps/app` (`.env.local` for local dev only; EAS builds use `eas.json`'s `env` block instead)
`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOCKET_URL` (primary = Railway), `EXPO_PUBLIC_LOCAL_API_URL`, `EXPO_PUBLIC_LOCAL_SOCKET_URL` (development-only
fallback), `EXPO_PUBLIC_API_MODE` (`auto` | `primary` | `local`, development only). Resolved in **one place** — the pure function
`apps/app/lib/apiConfig.ts` (wired by `lib/config.ts`); which endpoint is *currently active* is owned by `lib/apiEndpoint.ts`
(`EndpointManager` in `lib/endpointManager.ts`), and both `lib/api.ts` (REST) and `lib/socket.ts` (realtime) read from it.
Primary = env var → `app.json` `expo.extra`. Local (dev only) = env var → derived from the Metro host on port 4000 (Android emulator →
`10.0.2.2`). **Release builds ignore every local setting and always use `primary`.** `eas.json` `preview`/`production` set the Railway URLs.
All are public values inlined at Metro bundle time — restart with `npx expo start -c`, no native rebuild. Full table + device recipes:
`docs/local-and-railway.md`.

`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
/ `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Google Sign-In —
Google issues one OAuth client ID per platform; `GoogleSignInButton.tsx` renders nothing until at
least one is set; none of these three are interchangeable with `apps/api`'s or `apps/web`'s Google
client IDs, though all can share one Google Cloud project/consent screen).

**Never write an actual value for any of the above into this README or any other checked-in file.**
If you ever see a real key/secret/password pasted into a conversation, treat it as compromised and
tell the user to rotate it from the Supabase/Stripe/Sentry dashboard.

---

## 10. Local setup

```bash
npm install
cp apps/api/.env.example apps/api/.env        # then fill in real values
cp apps/web/.env.local.example apps/web/.env.local
docker compose up -d redis                     # Postgres is Supabase, not local
cd apps/api
npx prisma generate
npx prisma migrate resolve --applied 20260709120000_init   # DB is already provisioned on Supabase
npm run prisma:seed                            # idempotent
npm test
cd ../..
npm run dev:api     # http://localhost:4000/api — Swagger at /api/docs
npm run dev:web     # http://localhost:3000
npm run dev:app     # or: cd apps/app && npx expo start
```

**Local API + Railway together, with automatic mobile failover (dev only):** see `docs/local-and-railway.md`. Short version: put
`HOST="0.0.0.0"`, a local `REDIS_URL` and `AUTO_DELIVER_SCAN_ENABLED="false"` in `apps/api/.env`, run `npm run dev:api` and `npm run dev:app`;
`npm run dev:lan-ip` prints your LAN IP/firewall command. Use `EXPO_PUBLIC_API_MODE=primary` to pin Railway or `=local` to pin your machine.
Check both APIs are the same app over the same data with `npm run env:fingerprint --workspace=@otlob/api` (run locally and on Railway, compare).
Test commands: `npm run test:api` (jest), `npm run test:app` (`node --test`, incl. real Socket.IO servers).

To reach the dashboards: register normally, then promote your user's `role` via `npx prisma
studio` or direct SQL, log back in, open Profile → "لوحة التحكم".

## 11. Deploying

- **API**: any Node/Docker host — Railway is the current target (Dockerfile provided). Set every var from `apps/api/.env.example`. In production, prefer the pooler (6543) for `DATABASE_URL` and keep `DIRECT_URL` on 5432 for migrations; run `npx prisma migrate deploy` (not `migrate dev`).
- **Web**: Vercel (project `otlob`, linked to `bodyelshafey/OTLOB` on GitHub) — set `NEXT_PUBLIC_API_URL` to the deployed API's `/api` URL.
- **Mobile**: `eas build` per `apps/app/eas.json` profiles; distributed via EAS/App Store/Play Store, not auto-deployed.

---

## 12. What's fully built

- Complete Prisma schema + migrations for every table above, hosted on Supabase Postgres.
- Auth: register (phone-only, 2-step — account, phone OTP, sole verification step as of the
  2026-09-13 phone-first pivot — see §8), login (phone-or-email identifier, gated on phone
  verification only), optional "Add your email" step with no OTP (§8.4), Google Sign-In (with
  account linking and a `phoneVerificationRequired` flag for the phone gap — §8.5),
  forgot/reset password (email accounts only), refresh/logout, driver promotion (admin-only,
  §8.10). Argon2 hashing, role guard, per-route rate limiting (§6), structured duplicate/conflict
  errors with stable `code`s (§8.12).
- Full commerce flow: store types → categories → products → cart → checkout (transactional:
  validates store open + minimum order, computes commission + delivery fee, creates order, clears
  cart) → order status state machine → reviews (auto-recalculates rating) → favorites → coupons →
  addresses/zones/districts.
- Profile editing (Phase 3, 2026-09-13): name, avatar (reuses the existing upload module, no
  duplicate upload system), and optional email (§8.4, no OTP) — built on both web
  (`/profile/edit`, new) and mobile (`profile/edit.tsx`, extended). Phone stays read-only here,
  routed to the OTP-protected `/account/add-phone` flow.
- Super Admin users management (Phase 4, 2026-09-13): server-side search by name/email/phone,
  paginated, with an "إضافة كمندوب" (promote-to-driver) action + confirm dialog wired to the
  already-secure backend endpoint (§8.10). Web only — no equivalent on mobile yet.
- Driver availability gating (Phase 5, 2026-09-13): `available-orders`/`accept` now actually check
  the requesting driver's own `DriverStatus` (§ drivers row in the module map above) — previously
  every driver saw every `READY` order regardless of their status. `acceptOrder` sets
  `ON_DELIVERY`; `OrdersService.updateStatus` releases it back to `AVAILABLE` on `COMPLETED` (a
  companion fix — without it, a driver's first delivery would leave them stuck forever). Web
  driver dashboard (`/dashboard/driver`) already existed and is fully built (status toggle now
  hydrated from real state, stats, available-orders list, accept flow); mobile's is still a stub
  (§13).
- File uploads to Supabase Storage (4 buckets, type/size validated).
- Cashier system (Phase 6, 2026-09-13): store-owner-created username+password accounts, scoped
  dashboard, order problem-flagging (Phase 7), and a server-side 2-hour auto-delivery cron (Phase
  8) — see §13 for exactly what was and wasn't verified.
- Realtime order/driver/notification updates over Socket.IO.
- BullMQ background jobs (notifications, daily store reports).
- Web: full customer flow + all three dashboards (store/driver/admin), responsive, RTL, EN/AR
  toggle on shell + home page.
- Mobile: full customer flow, store-owner dashboard.
- Unit tests for auth + checkout logic.

## 13. What's intentionally NOT built yet (don't assume otherwise)

- **Seamless realtime/jobs across two API instances** — no Redis Socket.IO adapter, BullMQ/Redis and rate-limit counters are per instance; mobile
  failover moves the app between APIs but missed events aren't replayed (details: `docs/local-and-railway.md`).
- **Idempotency keys for order/payment creation** — hence failed mutating requests are never auto-retried on another server.
- **Web failover** — intentionally none (production site must never depend on a dev machine).
- **Unverified (not testable from the sandbox that built it):** Railway's own `DATABASE_URL`/JWT secrets matching local ones (use
  `env:fingerprint`), a full login against a live API, and the Railway Healthcheck Path setting.

- **Mobile driver dashboard** — still a stub; needs feature parity with web's `/dashboard/driver`.
- **Mobile admin dashboard** — partially built (221 lines vs. web's full admin section); needs the
  remaining admin screens (store-types, banners, commission, notification campaigns, audit log).
- **Full i18n coverage** — only the app shell + home page are translated on web; most other pages
  are Arabic-only. Same pattern applies to mobile.
- **E2E tests** — only unit tests exist (auth + checkout); no Supertest/Detox/Playwright suite.
- **Redis caching** — Redis is BullMQ-only; all reads hit Postgres directly.
- **Chat between customer/driver/store** — realtime rooms exist as groundwork; no chat UI/persistence.
- **Self-service role upgrade** — becoming a store owner requires manual promotion (`PATCH
  /users/:id/role`, SUPER_ADMIN only); becoming a driver requires admin promotion (`PATCH
  /users/:id/promote-to-driver`, §8.10) — no onboarding flow for either yet.
- **Native push via FCM/APNs** — `expo-server-sdk` + in-app/realtime notifications work; check
  current state before assuming full native push is wired end-to-end in production.
- **Real SMS/WhatsApp delivery** — `SmsProvider` architecture + a Twilio implementation exist (see
  §8.8), but no vendor account/credentials are configured yet. Registration's phone OTP (the sole
  verification step as of the 2026-09-13 phone-first pivot, §8.2) currently only reaches the
  server console log — **this means real users cannot actually complete registration in
  production right now**, until `SMS_PROVIDER`/`TWILIO_*` are set. This remains the single most
  urgent remaining item.
- **Distributed (Redis-backed) rate limiting** — `/auth/*` limits (§6) are enforced per-instance in
  memory; correct for one API instance, but won't hold the same effective ceiling once horizontally
  scaled to multiple instances. Flagged, not fixed.
- **Google OAuth credentials** — `GOOGLE_CLIENT_ID` (api) / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web) /
  `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` (mobile, one per platform) are all unset; Google Sign-In code is
  in place on all three clients but returns 400 / renders nothing until a Google Cloud OAuth
  consent screen + these client IDs exist.
- **Mobile driver dashboard** — still a stub (unlike the web one, which is fully built: status
  toggle hydrated from real server state, available-orders list, accept action, earnings/completed
  stats). Porting the web dashboard's screens to `apps/app` hasn't happened yet.
- **Cashier system — built 2026-09-13 (Phase 6)**: `POST /stores/:storeId/employees/cashiers`
  creates a brand-new username+password `User` (role `EMPLOYEE`, `phoneVerified: true` — no phone
  to verify, trust comes from the owner's authority) plus its `StoreMember` row (`role: CASHIER`)
  in one transaction; structured `USERNAME_ALREADY_EXISTS` on conflict. `AuthService.login` gained
  a third identifier fallback (username) for these accounts. Store-owner UI is in
  `/dashboard/store/employees` (new "إضافة كاشير" form, alongside the old link-existing-user flow
  for managers). A dedicated `/dashboard/cashier` (web) exists — order management only, no
  products/offers/settings access — reusing the already-correctly-scoped
  `GET /orders/store/:storeId` + `PATCH /orders/:id/status` endpoints (they already accepted
  `EMPLOYEE`). **Mobile cashier dashboard not built.**
- **Order problem/issue flagging + 2-hour auto-delivery rule — built 2026-09-13 (Phase 7/8)**:
  `Order` gained `hasIssue`/`issueReason`/`issueReportedAt`/`issueReportedBy`/`updatedAt`
  (migration `20260913130000_order_issue_flag_and_updated_at`). `POST /orders/:id/issue` (cashier
  "Problem" action) and `.../issue/resolve` exist. `DeliveryAutomationProcessor` (new
  `delivery-automation` BullMQ queue, repeatable job registered once at boot) scans every
  `AUTO_DELIVER_SCAN_INTERVAL_MINUTES` (default 10) for `DELIVERING` orders past
  `AUTO_DELIVER_AFTER_MINUTES` (default 120) with `hasIssue: false`, and transitions each via an
  atomic conditional `updateMany` (not a blind write) — re-checks `orderStatus`/`hasIssue` at write
  time, so a problem reported between the scan's SELECT and its UPDATE safely skips that order, and
  re-running the whole scan is a no-op for anything already handled (idempotent by construction,
  not by a separate lock). Releases the driver back to `AVAILABLE` and queues the same completion
  notification a human-triggered completion would. **Build fix, 2026-09-25**: the guarded
  `order.updateMany` originally also tried a nested `statusHistory: { create: {...} } }` —
  `updateMany` doesn't support nested relation writes (that's `update()`-only), which broke
  `npm run build --workspace=@otlob/api` (`TS2353`). Fixed by wrapping the guarded `updateMany`
  and a separate `orderStatusHistory.create` in one `prisma.$transaction`: the history row is
  only created when `updateMany`'s count is `> 0`, so a retried/re-run job (which matches zero
  rows for an order it already handled) still can't produce a duplicate `COMPLETED` history entry,
  and the transaction keeps the status flip and its history row atomic together.
- **Distinct order-status-machine naming for cashiers** (`PENDING → PREPARING → READY_FOR_DELIVERY
  → OUT_FOR_DELIVERY → DELIVERED` as requested) — deliberately NOT introduced as a second enum;
  the cashier dashboard groups the existing `OrderStatus` values into the same four buckets the
  request describes (New/Active/Completed/Problem) instead. If literal renamed status VALUES turn
  out to be required (not just UI grouping), that's a bigger, riskier migration — flag it
  explicitly before doing it, since it touches every consumer of `OrderStatus`.
- **Phase 9 (full QA)** — every backend change through Phase 8 was verified with
  `npx tsc --noEmit -p tsconfig.json` across the ENTIRE `apps/api` project (not just changed
  files) after each phase, confirming zero new type errors beyond the known
  Prisma-client-not-generated gap (see the sandbox note in §6). That is real, executed
  verification — but it is NOT the same as running the app, hitting real HTTP endpoints, or
  exercising the auto-delivery job against a live Redis+Postgres over real time. **Nothing in
  Phases 6-8 has been run end-to-end.** Before trusting this in production: run
  `npx prisma generate && npm run build --workspace=apps/api` in a real environment, then
  manually exercise — register a cashier account and log in with its username; have a cashier
  report a problem and confirm the order is excluded from an auto-delivery test run; temporarily
  lower `AUTO_DELIVER_AFTER_MINUTES`/`AUTO_DELIVER_SCAN_INTERVAL_MINUTES` in a staging environment
  and confirm a real `DELIVERING` order actually flips to `COMPLETED` on schedule, exactly once,
  and that the driver is released.

---

## 14. Conventions to follow when adding code

- Mobile networking: every REST call goes through `apps/app/lib/api.ts` and every realtime call through `lib/socket.ts`; never `fetch`/`axios` a
  hardcoded URL, never read `EXPO_PUBLIC_*` URLs outside `lib/config.ts`. Mutating requests must never be replayed to another endpoint.
- New public probe-style endpoints get `@Public()` **and** `@SkipThrottle()`; they must not expose configuration.
- New backend feature → new module under `apps/api/src/modules/<name>/` (controller + service +
  DTOs), registered in `app.module.ts`, protected with `@Roles(...)` unless it's genuinely public.
- Any schema change → new Prisma migration, never edit an already-applied one.
- Frontend changes never call Supabase/Postgres/Redis directly — always go through the API.
- When adding a mobile screen, check the equivalent web page first for the real field names/response
  shapes (the mobile client has previously drifted from actual API responses — see
  `apps/app/README.md` for the list of mismatches already found and fixed).
- Keep Arabic-first RTL layout; English is a secondary toggle, not the default.
- Design tokens: brand `#12bfe5` (primary), `#eefcff` (background), `#ff8a3d` (accent); fonts —
  Cairo (display), Tajawal (body), IBM Plex Mono (prices/codes); `rounded-xl2` cards with soft
  shadows.
- **Update this README's relevant section(s) whenever you change something it documents.**
