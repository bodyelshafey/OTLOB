// Staged capacity test — mixed realistic OTLOB traffic (browsing, auth,
// cart, checkout, order tracking) ramped through 50 → 100 → 200 → 400 → 800
// concurrent users, one stage at a time, so an unstable stage is visible
// before the next one starts rather than everything blurring together.
//
// This does NOT replace public-browse.js / auth-flow.js / checkout.js —
// those are still useful for isolating one flow at a time. This script
// answers a different question: "what happens under realistic *mixed*
// load," which is what actually determines real capacity, since browsing
// and checkout compete for the same DB connection pool simultaneously in
// production, not one at a time.
//
// STAGING ONLY. Never run against production.
//
// Run one stage at a time (recommended — see README):
//   k6 run --env BASE_URL=... --env TEST_EMAIL=... --env TEST_PASSWORD=... \
//     --env STORE_ID=... --env PRODUCT_ID=... --env STAGE=1 load-tests/staged-capacity-test.js
//
// STAGE maps to target concurrency: 1=50, 2=100, 3=200, 4=400, 5=800
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;
const STORE_ID = __ENV.STORE_ID;
const PRODUCT_ID = __ENV.PRODUCT_ID;

const STAGE_TARGETS = { 1: 50, 2: 100, 3: 200, 4: 400, 5: 800 };
const stage = Number(__ENV.STAGE) || 1;
const target = STAGE_TARGETS[stage] || 50;

// Separate counters per flow so a slow checkout doesn't get averaged away
// by a fast browse request in the overall summary.
const checkoutLatency = new Trend('checkout_duration', true);
const browseLatency = new Trend('browse_duration', true);
const authLatency = new Trend('auth_duration', true);
const orderErrors = new Counter('order_errors');

export const options = {
  scenarios: {
    mixed_traffic: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target }, // ramp to this stage's target
        { duration: '2m', target }, // hold — this is the window that actually matters
        { duration: '20s', target: 0 }, // ramp down cleanly
      ],
    },
  },
  thresholds: {
    // abortOnFail stops the run automatically instead of continuing to
    // hammer an already-unstable system — this is the automated version
    // of "do not blindly continue if the system becomes unstable."
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true }],
    'checkout_duration': ['p(95)<3000'],
    'browse_duration': ['p(95)<800'],
  },
};

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

// Each VU iteration picks ONE realistic user journey, weighted toward
// browsing (most real traffic) with occasional auth/checkout — not every
// VU checks out every iteration, which would overstate order volume
// relative to actual OTLOB usage patterns.
export default function () {
  const roll = Math.random();

  if (roll < 0.6) {
    // 60% — pure browsing (home, store list, store detail, search)
    const t0 = Date.now();
    const storesRes = http.get(`${BASE_URL}/stores?limit=20`);
    check(storesRes, { 'stores 200': (r) => r.status === 200 });
    const stores = storesRes.status === 200 ? JSON.parse(storesRes.body).items ?? [] : [];
    if (stores.length > 0) {
      const s = stores[Math.floor(Math.random() * stores.length)];
      http.get(`${BASE_URL}/stores/${s.id}`);
      http.get(`${BASE_URL}/products?storeId=${s.id}&limit=20`);
    }
    http.get(`${BASE_URL}/offers`);
    browseLatency.add(Date.now() - t0);
  } else if (roll < 0.8 && TEST_EMAIL && TEST_PASSWORD) {
    // 20% — auth + authenticated browsing (notifications, own orders)
    const t0 = Date.now();
    const loginRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    authLatency.add(Date.now() - t0);
    if (loginRes.status === 200) {
      const { accessToken } = JSON.parse(loginRes.body);
      http.get(`${BASE_URL}/notifications`, authHeaders(accessToken));
      http.get(`${BASE_URL}/orders/me`, authHeaders(accessToken));
    }
  } else if (TEST_EMAIL && TEST_PASSWORD && STORE_ID && PRODUCT_ID) {
    // 20% — full checkout journey, the heaviest realistic request this app has
    const t0 = Date.now();
    const loginRes = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (loginRes.status === 200) {
      const { accessToken } = JSON.parse(loginRes.body);
      http.del(`${BASE_URL}/cart`, null, authHeaders(accessToken));
      http.post(
        `${BASE_URL}/cart`,
        JSON.stringify({ productId: PRODUCT_ID, quantity: 1 }),
        authHeaders(accessToken),
      );
      const orderRes = http.post(
        `${BASE_URL}/orders`,
        JSON.stringify({
          storeId: STORE_ID,
          customerName: 'Load Test',
          phone: '01000000000',
          fullAddress: 'Load test address, New Capital',
          paymentMethod: 'CASH',
        }),
        authHeaders(accessToken),
      );
      if (orderRes.status !== 201 && orderRes.status !== 200 && orderRes.status !== 429) {
        orderErrors.add(1);
      }
      checkoutLatency.add(Date.now() - t0);
    }
  }

  sleep(Math.random() * 2 + 1);
}
