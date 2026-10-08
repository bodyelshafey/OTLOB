# OTLOB — Load Testing

Uses [k6](https://k6.io) — a single binary, no npm dependency added to the
project. Install: `brew install k6` / `choco install k6` / see k6.io/docs.

## ⚠️ Never run these against production

Run against **local** or a **staging** environment with its own database.
`checkout.js` creates real orders and `auth-flow.js` performs real logins —
both would pollute production data and could trip real rate limits for
real users.

## Scripts

| Script | Covers | Needs |
|---|---|---|
| `public-browse.js` | Store list, store detail, product list, search — unauthenticated read load | Nothing extra, just `BASE_URL` |
| `auth-flow.js` | Login → `/users/me`, plus a documented way to verify the login rate limit actually blocks a burst | A pre-existing verified test account |
| `checkout.js` | Login → add to cart → create order — the most business-critical write path | Test account + a real `storeId`/`productId` in that environment |

## Running

```bash
# 1. Baseline read load
k6 run --env BASE_URL=http://localhost:4000/api load-tests/public-browse.js

# 2. Auth flow under moderate concurrency
k6 run --env BASE_URL=http://localhost:4000/api \
  --env TEST_EMAIL=loadtest@otlob.app --env TEST_PASSWORD=... \
  load-tests/auth-flow.js

# 3. Confirm the login rate limit actually triggers (not just configured)
k6 run --env BASE_URL=http://localhost:4000/api \
  --env TEST_EMAIL=loadtest@otlob.app --env TEST_PASSWORD=... \
  --vus 1 --iterations 15 load-tests/auth-flow.js
# Expect: ~8 requests succeed (200/401), the rest return 429.

# 4. Checkout under load
k6 run --env BASE_URL=http://localhost:4000/api \
  --env TEST_EMAIL=loadtest@otlob.app --env TEST_PASSWORD=... \
  --env STORE_ID=<uuid> --env PRODUCT_ID=<uuid> \
  load-tests/checkout.js
```

## What "realistic" means here

Numbers are picked to represent plausible traffic for a single-city
delivery app at moderate scale, not arbitrary stress-test maximums:

- **Steady state**: ~20 concurrent browsing users, ~10 concurrent
  checkouts — comparable to a busy lunch/dinner rush for one metro area.
- **Burst**: a spike to 50 concurrent browsers, simulating a push
  notification or promo driving a short traffic surge (this is also why
  Phase 6's notification-campaign send is queued through BullMQ rather
  than sent synchronously — a "send to all users" campaign is exactly
  the kind of event that would otherwise cause this burst pattern on the
  API itself).

## Thresholds and how to read results

Each script defines `thresholds` — k6 exits non-zero if they're violated,
so this is CI-friendly, not just a manual eyeball check:

- `public-browse.js`: p95 < 500ms, <1% error rate. These are simple,
  paginated, indexed reads — if this threshold fails, look for a missing
  index or an N+1 query first.
- `auth-flow.js`: p95 < 800ms. Argon2 password verification is
  deliberately slow (that's the point of using it) — this threshold
  accounts for that rather than expecting login to be as fast as a read.
- `checkout.js`: p95 < 1500ms, <2% error rate. This is the heaviest
  single request in the app (a DB transaction, commission calculation,
  and a BullMQ notification enqueue) — the queue enqueue itself should
  be near-instant (it's a Redis push, not a wait for delivery), so if
  this threshold fails, check whether the *transaction* itself is slow
  before suspecting the queue.

## What this does **not** cover

Being direct about the actual scope, per the instruction not to overstate
what was verified:

- **No live results are included in this repo.** These scripts were
  written and reviewed for correctness against the actual API contracts
  (request/response shapes match the real DTOs and controllers), but
  were not executed against a running server — this environment has no
  live OTLOB instance or database to run them against. Run them yourself
  against staging before trusting the thresholds above as proven, not
  just reasoned.
- **No notification fan-out load test.** Testing real push delivery at
  scale needs real Expo push tokens from real devices, which don't exist
  in a synthetic load test. What *is* covered indirectly: creating many
  orders in `checkout.js` each queues a notification job, which
  exercises the BullMQ enqueue path under load even without measuring
  actual push delivery.
- **No database-level load test** (e.g. pgbench) — these scripts test
  through the API, which is what actually matters for user-facing
  performance, but a dedicated DB-only test would isolate query
  performance from API/network overhead if that's ever needed.

## Staged capacity test (50 → 800 concurrent, mixed realistic traffic)

`staged-capacity-test.js` is the one to run for an actual capacity answer
— it mixes browsing (60%), authenticated reads (20%), and full checkout
(20%) in one run, which is what real production load looks like (these
compete for the same DB pool simultaneously, unlike running
`public-browse.js` and `checkout.js` separately).

**Run one stage at a time, in order, and stop if a stage is unstable —
do not jump straight to Stage 5:**

```bash
# Stage 1: 50 concurrent
k6 run --env BASE_URL=... --env TEST_EMAIL=... --env TEST_PASSWORD=... \
  --env STORE_ID=... --env PRODUCT_ID=... --env STAGE=1 \
  load-tests/staged-capacity-test.js

# Stage 2: 100 — only run if Stage 1 passed its thresholds
... --env STAGE=2 ...

# Stage 3: 200, Stage 4: 400, Stage 5: 800 — same pattern
```

The script's own `thresholds` (`http_req_failed` with `abortOnFail`) stop
a stage automatically if the error rate crosses 5% — but also watch the
external signals k6 itself cannot see, side by side with each run:

| Signal | Where to look | Why it matters more than k6's own numbers |
|---|---|---|
| Railway CPU / RAM | Railway dashboard, live during the run | k6 only tells you the *symptom* (slow/failed requests); this tells you the *cause* |
| Prisma/Postgres active connections | Supabase dashboard → Database → Connection pooling, or `SELECT count(*) FROM pg_stat_activity` | The default `pg.Pool` max is 10 per instance — watch for this maxing out before Postgres itself is under real strain |
| BullMQ queue depth | `redis-cli LLEN bull:notifications:wait` (or a small script using `queue.getJobCounts()`) during a checkout-heavy stage | Confirms whether `NOTIFICATIONS_QUEUE_CONCURRENCY` is enough to keep up with order volume at that stage, or whether delivery is falling behind |
| Redis memory/CPU | Railway dashboard for the Redis service | Job payloads are small JSON; this is unlikely to be the constraint, but confirm rather than assume |
| Socket.io connection count | Application logs, or a simple counter added temporarily to `realtime.gateway.ts`'s connection handler | Relevant since this app runs a single Socket.io instance — confirms whether connection count itself (not request load) becomes a memory pressure point |

Record, per stage: requests/sec, p50/p95/p99, error rate, and the five
signals above. The first one to visibly degrade *before* the others is
your actual bottleneck — not whichever one seems intuitive.
