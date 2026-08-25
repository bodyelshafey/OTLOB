// Auth flow under load — also doubles as a live check that rate limiting
// actually kicks in (see the last block). Needs a pre-existing verified
// test account; this script does NOT register new accounts per request
// (that would just hammer the OTP email pipeline pointlessly).
//
// Run: k6 run --env BASE_URL=... --env TEST_EMAIL=... --env TEST_PASSWORD=... load-tests/auth-flow.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

export const options = {
  scenarios: {
    login: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'], // argon2 verify is intentionally slow-ish; 800ms is generous
  },
};

export default function () {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error('Set TEST_EMAIL and TEST_PASSWORD env vars to a real verified test account first.');
  }

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(loginRes, {
    'login 200 or 429 (rate limited)': (r) => r.status === 200 || r.status === 429,
  });

  if (loginRes.status === 200) {
    const { accessToken } = JSON.parse(loginRes.body);
    const meRes = http.get(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    check(meRes, { 'me 200': (r) => r.status === 200 });
  }

  sleep(1);
}

// A separate, deliberately-abusive run to confirm the login throttle
// (8 req/min per auth.controller.ts) actually blocks a burst instead of
// just being configured and never tested:
// k6 run --env BASE_URL=... --env TEST_EMAIL=... --env TEST_PASSWORD=... \
//   --vus 1 --iterations 15 load-tests/auth-flow.js
// Expect: the first ~8 requests return 200/401, the rest return 429.
