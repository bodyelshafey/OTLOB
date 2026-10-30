const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadFresh, stub, clearStubs } = require("./helpers/tsRequire");

clearStubs();
const { probeHealth } = loadFresh("lib/healthProbe.ts");

const BASE = "https://otlob-railway.example/api";
const json = (status, body) => ({ status, json: async () => body });

/** fetch fake: routes by URL suffix, records calls, honours AbortSignal. */
function fakeFetch(routes) {
  const calls = [];
  const fn = (url, init = {}) => {
    calls.push(url);
    const handler = routes[url.replace(BASE, "")];
    if (!handler) return Promise.reject(new TypeError("Network request failed"));
    if (handler === "hang") {
      return new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    }
    return Promise.resolve(handler);
  };
  fn.calls = calls;
  return fn;
}

const READY_OK = json(200, { status: "ok", service: "otlob-api", checks: { database: "up" } });

test("healthy: /health/ready 200 from the OTLOB API", async () => {
  const f = fakeFetch({ "/health/ready": READY_OK });
  assert.equal(await probeHealth(BASE, { fetchImpl: f }), true);
  assert.deepEqual(f.calls, [`${BASE}/health/ready`]);
});

test("API up but database down: 503 → unhealthy, and does not fall back to the legacy endpoint", async () => {
  const f = fakeFetch({ "/health/ready": json(503, { status: "unavailable", service: "otlob-api", checks: { database: "down" } }) });
  assert.equal(await probeHealth(BASE, { fetchImpl: f }), false);
  assert.equal(f.calls.length, 1);
});

test("older Railway deployment without /health/ready: API-shaped 404 → falls back to legacy /health", async () => {
  const f = fakeFetch({
    "/health/ready": json(404, { success: false, statusCode: 404, message: "Cannot GET /api/health/ready" }),
    "/health": json(200, { status: "ok", database: "up" }),
  });
  assert.equal(await probeHealth(BASE, { fetchImpl: f }), true);
  assert.equal(f.calls.length, 2);
});

test("legacy endpoint reporting 'degraded' is unhealthy", async () => {
  const f = fakeFetch({
    "/health/ready": json(404, { success: false, statusCode: 404, message: "x" }),
    "/health": json(200, { status: "degraded", database: "down" }),
  });
  assert.equal(await probeHealth(BASE, { fetchImpl: f }), false);
});

test("Railway-edge 'Application not found' is NOT mistaken for an old API → unhealthy, no legacy retry", async () => {
  const f = fakeFetch({ "/health/ready": json(404, { status: "error", code: 404, message: "Application not found" }) });
  assert.equal(await probeHealth(BASE, { fetchImpl: f }), false);
  assert.equal(f.calls.length, 1);
});

test("a captive portal / wrong server answering 200 is not a healthy OTLOB API", async () => {
  assert.equal(await probeHealth(BASE, { fetchImpl: fakeFetch({ "/health/ready": json(200, { status: "ok" }) }) }), false, "missing service marker");
  const html = { status: 200, json: async () => { throw new SyntaxError("not json"); } };
  assert.equal(await probeHealth(BASE, { fetchImpl: fakeFetch({ "/health/ready": html }) }), false);
});

test("network failure → unhealthy (never throws)", async () => {
  assert.equal(await probeHealth(BASE, { fetchImpl: fakeFetch({}) }), false);
});

test("a hung server is cut off by the bounded timeout", async () => {
  const started = Date.now();
  const ok = await probeHealth(BASE, { fetchImpl: fakeFetch({ "/health/ready": "hang" }), timeoutMs: 40 });
  assert.equal(ok, false);
  assert.ok(Date.now() - started < 1000);
});

test("probes carry no credentials (no Authorization header, so they can't trigger token refresh)", async () => {
  let seen;
  const f = (url, init) => { seen = init; return Promise.resolve(READY_OK); };
  await probeHealth(BASE, { fetchImpl: f });
  assert.equal(Object.keys(seen.headers).some((h) => /authorization/i.test(h)), false);
});
