# Running OTLOB against Railway **and** your local API

The mobile app can use the deployed API (Railway) and your own computer's API, and move between them
automatically **in development**. Production users are never affected: release builds only ever talk to
Railway.

| Client | Uses | Failover? |
|---|---|---|
| Mobile — **release** build (EAS `preview`/`production`) | Railway only | **No.** Local settings are ignored. |
| Mobile — **development** (Expo Go / dev client / `expo start`) | Railway first, local as fallback | **Yes** (`EXPO_PUBLIC_API_MODE=auto`, default) |
| Web (Next.js) | `NEXT_PUBLIC_API_URL`: Vercel env → Railway; `.env.local` → localhost | **No**, by design — a public website must never depend on a developer's computer |

## How the mobile failover behaves

All code lives in `apps/app/lib`: `apiConfig.ts` (which URLs), `endpointManager.ts` (decisions),
`healthProbe.ts` (health check), `apiEndpoint.ts` (wiring), `api.ts` / `socket.ts` (consumers).

- **Startup (dev, failover on):** probe Railway (`GET /api/health/ready`, 4 s timeout). Healthy → use Railway.
  Otherwise probe local (2.5 s). Healthy → use local. Neither → "no connection" banner with **Retry**.
  Requests made during this check wait for it (bounded by those timeouts).
- **While running:** nothing polls while Railway is healthy. A *connection failure, timeout, or a response that
  didn't come from our API (e.g. Railway's `404 Application not found`, 502/503/504)* triggers a re-check
  (max one per 10 s, never concurrent). Only if Railway fails **2 confirming probes** does the app move to local.
- **Recovery:** while on local (or with no connection) and the app is in the **foreground**, Railway is probed every
  15 s → 30 s → 60 s. It switches back after **2 consecutive healthy probes** and at least **30 s** on the fallback
  (no flapping). With no connection at all it keeps retrying on the same schedule and recovers by itself.
- **Never a reason to switch:** wrong password, validation errors, 401/403/404/409/429, or a 500 the API itself
  reported. Only availability failures count (`apps/app/lib/apiFailure.ts`).
- **Requests are never replayed to a different server unless they are safe to repeat.** A failed `GET`/`HEAD`
  may be retried **once** on the new endpoint. `POST`/`PUT`/`PATCH`/`DELETE` (orders, payments, registration…) are
  sent once, the real error is returned to the screen, and only *later* requests use the new endpoint. There is no
  idempotency-key mechanism in the API, so this is deliberate.
- **Auth:** the `Authorization` header is stamped on every request including a replayed `GET`. Token refresh goes to
  the *active* endpoint. If a refresh fails because the server is **unreachable**, the user stays logged in (it
  used to log them out).
- **Realtime:** the single Socket.IO connection is re-pointed at the active API (listeners are untouched), the token
  is sent fresh on every (re)connect, and `order:`/`store:` room subscriptions are re-sent after every connect.
- **Dev indicators:** a yellow banner shows when the local fallback is in use; the console logs
  `[endpoint] status=… active=…` on every change.

## Quick start (all commands exist in the repo's `package.json` files)

```bash
npm install
cp apps/api/.env.example apps/api/.env        # fill in real values (never commit)
docker compose up -d redis                     # local Redis (Postgres is Supabase)
npm run dev:api                                # API  → http://localhost:4000/api
npm run dev:app                                # Expo → `expo start` (use `npx expo start -c` after env changes)
npm run dev:web                                # Web  → http://localhost:3000   (set NEXT_PUBLIC_API_URL=http://localhost:4000/api in apps/web/.env.local)
npm run dev:lan-ip                             # prints your LAN IP + the Windows firewall command
npm run test:api                               # API unit/HTTP tests (jest)
npm run test:app                               # mobile tests (node --test; incl. real Socket.IO servers)
```

### `apps/api/.env` for a local instance that shares the production database

```
HOST="0.0.0.0"                                 # reachable from phones/emulators (default is 127.0.0.1 in dev)
REDIS_URL="redis://localhost:6379"             # NOT the Railway internal Redis — it is unreachable from outside Railway
AUTO_DELIVER_SCAN_ENABLED="false"              # don't run a second order auto-delivery scheduler on production data
# DATABASE_URL / DIRECT_URL / JWT_* / SUPABASE_*  → must match Railway (see "Consistency checklist")
```

### `apps/app/.env.local` (development only — copy `apps/app/.env.example`)

| Variable | Meaning | Default |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Primary API (Railway), incl. `/api` | `expo.extra.apiBaseUrl` in `app.json` |
| `EXPO_PUBLIC_SOCKET_URL` | Primary realtime URL | derived: `https→wss`, `/api→/realtime` |
| `EXPO_PUBLIC_LOCAL_API_URL` | Local API, incl. `/api`. **Optional** | derived from the Metro host, port 4000 |
| `EXPO_PUBLIC_LOCAL_SOCKET_URL` | Local realtime URL | derived from the local API URL |
| `EXPO_PUBLIC_API_MODE` | `auto` / `primary` / `local` | `auto` |

All are **public** (inlined in the JS bundle): never put secrets in `EXPO_PUBLIC_*`. They are read when Metro
bundles, so changing them needs `npx expo start -c` — **not** a native rebuild.

### Device scenarios

- **Physical phone (Android/iOS):** same Wi-Fi as your computer. With defaults you configure nothing — the app uses
  the Metro host's IP, so a changed IP is picked up on the next reload. To pin it:
  `EXPO_PUBLIC_LOCAL_API_URL=http://<LAN-IP>:4000/api` (`npm run dev:lan-ip`). Sanity check from the phone's browser:
  `http://<LAN-IP>:4000/api/health/live`.
- **Android emulator:** `localhost` is the emulator itself; your computer is `10.0.2.2`. The app maps this
  automatically; the explicit form is `http://10.0.2.2:4000/api`.
- **iOS simulator:** shares the Mac's network, `http://localhost:4000/api` works.
- **Expo tunnel (`--tunnel`):** Metro's host is a tunnel domain, so no local candidate can be derived → Railway only
  (set `EXPO_PUBLIC_LOCAL_API_URL` explicitly if you want a fallback).
- **Windows firewall:** allow inbound TCP 4000 once (PowerShell as Administrator):
  `New-NetFirewallRule -DisplayName "OTLOB API 4000" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow -Profile Private`
- **Cleartext HTTP:** the local API is plain `http://`. Nothing in this repo enables cleartext traffic (managed Expo
  workflow: no `android/` folder, no `expo-build-properties`, nothing in `app.json`/`eas.json`) and that is intentional for
  release builds — the local fallback is disabled there anyway. Expo Go is known to allow HTTP to a LAN dev server and a
  dev-client build is expected to as well, but **this could not be verified from here** (the Android template isn't
  installed in the repo). If a dev-client build reports `Network request failed` for an `http://` URL that opens fine in the
  phone's browser, enable `usesCleartextTraffic` for the **development EAS profile only** (e.g. an `app.config.js` that reads
  `EAS_BUILD_PROFILE` and adds `expo-build-properties`) — never for `preview`/`production`.

## Consistency checklist — do this before trusting failover

Both APIs must be the *same application* over the *same data*. Run the same command in both places and compare:

```bash
npm run env:fingerprint --workspace=@otlob/api                   # local
railway run npm run env:fingerprint --workspace=@otlob/api       # Railway (or run `node scripts/env-fingerprint.js` in a Railway shell)
```

It prints only non-secret fingerprints. These lines **must be identical**: `DATABASE_URL` (host/db/project ref),
`SUPABASE_URL host`, `JWT_ACCESS_SECRET fp`, `JWT_REFRESH_SECRET fp`, `SUPABASE_SERVICE_ROLE_KEY fp`, and the JWT
expiries. `REDIS_URL` and `AUTO_DELIVER_SCAN_ENABLED` are expected to differ.

- **Database.** Verified for the local `.env`: it points at the Supabase project `alfokhlyoitokzkahgce` (transaction
  pooler). Railway's value could not be read from here — the fingerprint comparison is how you confirm it.
- **JWT secrets.** If they differ, a token issued by one API is rejected by the other → 401 → refresh fails → the user
  is logged out when failover happens. Refresh tokens live in the shared DB, so matching secrets is all that's needed.
- **Storage.** Uploads go through the API into Supabase Storage with the service-role key; same project ⇒ same files.
- **Migrations — read this.** As of 2026-10-25 the production DB has `20260831010000_remove_account_verification`
  applied that the repo no longer contains, and the repo has `20261010090000_order_address_on_delete_set_null` that
  production lacks. **Never run `prisma migrate dev` (the `prisma:migrate` script) against the shared database** — with
  that drift it can offer to reset it. Production schema changes: review, then `prisma migrate deploy`, deliberately.
- **Seed/test data:** don't run `prisma:seed` or destructive scripts against the shared DB from a local instance.

## What does NOT work seamlessly across the two APIs

- **Realtime is per instance.** Each API has its own in-memory Socket.IO server (no Redis adapter). A client on the
  local API does **not** receive `order:new` / `order:status` / `notification:new` caused by requests handled by Railway
  (and vice-versa), and rooms/driver locations aren't shared. After a switch the app reconnects and re-joins its
  rooms, but missed events are not replayed — pull-to-refresh/REST is the source of truth. Making this seamless needs
  `@socket.io/redis-adapter` on a Redis **both** APIs can reach (not currently the case).
- **Background jobs/Redis are per instance** (BullMQ queues live in each API's own Redis): the 2-hour auto-delivery scan,
  push-notification queue, etc. run where they were enqueued. Hence `AUTO_DELIVER_SCAN_ENABLED=false` locally.
- **Rate limits are per instance** (in-memory throttler counters).
- **No idempotency keys** on order/payment endpoints — a failed `POST` is never auto-retried; the user re-submits.
- **Web** has no failover (intentional).

## Testing failover safely

Automated (nothing touches production data): `npm run test:app` and `npm run test:api`.

Manual, with a real phone — **use test accounts and never place orders against real stores**:
1. Start the local API and the app (`npm run dev:api`, `npm run dev:app`). You are on Railway (no banner).
2. Simulate Railway being down *without touching Railway*: in `apps/app/.env.local` set
   `EXPO_PUBLIC_API_URL=https://railway-down.invalid/api`, run `npx expo start -c`, reload → yellow "using local API" banner.
3. Restore the real URL, restart Metro → back on Railway. (Live recovery within one session is covered by the automated tests.)
4. Stop the local API **and** break the URL → "No connection" banner with **Retry**.

## Railway

- Set the service **Healthcheck Path** to `/api/health/live` (Service → Settings → Deploy). It never touches the database,
  needs no auth and is exempt from rate limiting. (This is a dashboard setting; the repo deliberately has no
  `railway.json` so deploy behaviour doesn't change silently.)
- `GET /api/health/ready` → `200` when the DB answers, `503` otherwise (cached ≤5 s; this is what the app probes).
  `GET /api/health` keeps its original contract (always 200, `status: ok|degraded`).
- `Application not found` = Railway's edge saying no running service owns that domain. Check the service is deployed and
  its public domain is attached; if the domain changed update `NEXT_PUBLIC_API_URL` (Vercel), `apps/app/eas.json`,
  `apps/app/app.json`.
