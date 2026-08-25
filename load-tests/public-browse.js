// Public browse traffic: store list, store detail, product list, search.
// No auth needed — this is the traffic every visitor generates just
// looking around, and the most common real-world load pattern.
//
// Run: k6 run --env BASE_URL=http://localhost:4000/api load-tests/public-browse.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 }, // ramp to 20 concurrent users
        { duration: '2m', target: 20 }, // hold — realistic steady browsing load
        { duration: '30s', target: 50 }, // burst — simulates a promo/notification driving a traffic spike
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 }, // ramp down
      ],
    },
  },
  thresholds: {
    // Read endpoints with no auth and simple Prisma queries should be
    // fast — if p95 creeps past this, something regressed (missing index,
    // N+1, oversized response).
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'], // <1% errors under this load
  },
};

export default function () {
  const storesRes = http.get(`${BASE_URL}/stores?limit=20`);
  check(storesRes, {
    'stores list 200': (r) => r.status === 200,
    'stores list has items': (r) => JSON.parse(r.body).items?.length > 0,
  });

  const stores = JSON.parse(storesRes.body).items ?? [];
  if (stores.length > 0) {
    const store = stores[Math.floor(Math.random() * stores.length)];
    const storeRes = http.get(`${BASE_URL}/stores/${store.id}`);
    check(storeRes, { 'store detail 200': (r) => r.status === 200 });

    const productsRes = http.get(`${BASE_URL}/products?storeId=${store.id}&limit=20`);
    check(productsRes, { 'products list 200': (r) => r.status === 200 });
  }

  const searchRes = http.get(`${BASE_URL}/stores?search=pizza&limit=10`);
  check(searchRes, { 'search 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1); // 1-3s between actions, like a real user
}
