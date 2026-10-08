// Checkout/order creation — the most business-critical write path, and
// the one place a queue-timing bug or a missing index would actually cost
// money (failed or slow orders). Needs a real verified test account and a
// known storeId/productId that exist in whatever environment this targets.
//
// Run: k6 run --env BASE_URL=... --env TEST_EMAIL=... --env TEST_PASSWORD=... \
//   --env STORE_ID=... --env PRODUCT_ID=... load-tests/checkout.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;
const STORE_ID = __ENV.STORE_ID;
const PRODUCT_ID = __ENV.PRODUCT_ID;

export const options = {
  scenarios: {
    checkout: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '20s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.02'],
  },
};

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

export default function () {
  if (!TEST_EMAIL || !TEST_PASSWORD || !STORE_ID || !PRODUCT_ID) {
    throw new Error('Set TEST_EMAIL, TEST_PASSWORD, STORE_ID, PRODUCT_ID env vars first.');
  }

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (loginRes.status !== 200) {
    sleep(2);
    return;
  }
  const { accessToken } = JSON.parse(loginRes.body);

  http.del(`${BASE_URL}/cart`, null, authHeaders(accessToken));
  const addRes = http.post(
    `${BASE_URL}/cart`,
    JSON.stringify({ productId: PRODUCT_ID, quantity: 1 }),
    authHeaders(accessToken),
  );
  check(addRes, { 'add to cart 200/201': (r) => r.status === 200 || r.status === 201 });

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
  check(orderRes, {
    'order created or rate-limited': (r) => r.status === 201 || r.status === 200 || r.status === 429,
  });

  sleep(Math.random() * 2 + 1);
}
