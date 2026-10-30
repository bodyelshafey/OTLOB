/**
 * Integration tests for lib/api.ts: the REAL axios client + interceptors + the
 * REAL EndpointManager, against scripted fake "servers" (no network, no mocks
 * of the logic under test). Only the transport adapter, the auth store and the
 * clock are faked.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { ROOT, loadFresh, stub, clearStubs } = require("./helpers/tsRequire");
const { FakeClock, FakeNetwork } = require("./helpers/fakeClock");

const axios = require(require.resolve("axios", { paths: [ROOT] }));

const PRIMARY = "https://otlob-railway.example/api";
const LOCAL = "http://10.0.2.2:4000/api";

const OK = (data = { ok: true }) => ({ status: 200, data });
const API_ERR = (statusCode, message = "err") => ({ status: statusCode, data: { success: false, statusCode, message } });
const RAILWAY_EDGE_404 = { status: 404, data: { status: "error", code: 404, message: "Application not found" } };
const NETWORK = { error: "network" };
const TIMEOUT = { error: "timeout" };

/**
 * Builds a fresh world: fake servers keyed by base URL, a real manager, a fake
 * auth store, and the real api module wired to them.
 */
async function world({ failover = true, up = { [PRIMARY]: true, [LOCAL]: true }, tokens = {}, awaitStart = true } = {}) {
  clearStubs();
  const clock = new FakeClock();
  const net = new FakeNetwork(up);
  const { EndpointManager } = loadFresh("lib/endpointManager.ts");
  const manager = new EndpointManager({
    primaryUrl: PRIMARY,
    localUrl: LOCAL,
    failoverEnabled: failover,
    probe: net.probe,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    sleep: async () => {}, // confirmation probes back-to-back; timing is covered in endpointManager.test.js
  });

  const auth = {
    accessToken: tokens.accessToken ?? null,
    refreshToken: tokens.refreshToken ?? null,
    setTokensCalls: 0,
    logoutCalls: 0,
    setTokens(a, r) { auth.accessToken = a; auth.refreshToken = r; auth.setTokensCalls++; },
    logout() { auth.accessToken = null; auth.refreshToken = null; auth.logoutCalls++; },
  };

  const servers = { [PRIMARY]: () => OK(), [LOCAL]: () => OK() };
  const calls = [];

  const adapter = async (config) => {
    const full = (config.baseURL ?? "") + config.url;
    const base = Object.keys(servers).find((b) => full.startsWith(b));
    const authHeader = config.headers?.Authorization ?? config.headers?.get?.("Authorization");
    calls.push({ server: base === PRIMARY ? "primary" : base === LOCAL ? "local" : "?", method: config.method, url: full.slice(base.length), auth: authHeader });
    const out = servers[base]({ method: config.method, url: full.slice(base.length), auth: authHeader });
    if (out.error === "network") throw new axios.AxiosError("Network Error", "ERR_NETWORK", config, {});
    if (out.error === "timeout") throw new axios.AxiosError("timeout of 15000ms exceeded", "ECONNABORTED", config, {});
    const response = { data: out.data, status: out.status, statusText: "", headers: {}, config, request: {} };
    if (out.status >= 200 && out.status < 300) return response;
    throw new axios.AxiosError(`Request failed with status code ${out.status}`, out.status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST", config, {}, response);
  };
  axios.defaults.adapter = adapter; // used by the bare axios.post in the refresh flow

  stub("@/lib/apiEndpoint", { endpointManager: manager });
  stub("@/store/authStore", { useAuthStore: { getState: () => auth } });
  const { api } = loadFresh("lib/api.ts");
  api.defaults.adapter = adapter;

  if (awaitStart) await manager.start();
  net.calls.length = 0; // only count probes caused by the scenario itself

  const on = (name) => calls.filter((c) => c.server === name);
  return { api, manager, net, clock, auth, servers, calls, on, PRIMARY, LOCAL };
}

const rejects = async (promise) => {
  try { await promise; } catch (e) { return e; }
  assert.fail("expected the request to reject");
};

describe("expected errors never change the server", () => {
  test("7. invalid login credentials: 401 surfaced as-is, no probes, no switch", async () => {
    const w = await world();
    w.servers[PRIMARY] = () => API_ERR(401, "Invalid credentials");
    const err = await rejects(w.api.post("/auth/login", { phone: "x", password: "wrong" }));
    assert.equal(err.response.status, 401);
    assert.equal(w.net.calls.length, 0, "no health probe was triggered");
    assert.equal(w.manager.getSnapshot().active, "primary");
    assert.equal(w.on("local").length, 0);
    assert.equal(w.on("primary").length, 1, "sent once, to Railway only");
  });

  test("8. validation error (400) and an API-reported 500: no probes, no switch", async () => {
    const w = await world();
    for (const out of [API_ERR(400, "phone must be valid"), API_ERR(500, "boom"), API_ERR(403, "no"), API_ERR(409, "dup")]) {
      w.servers[PRIMARY] = () => out;
      await rejects(w.api.post("/auth/register", {}));
    }
    assert.equal(w.net.calls.length, 0);
    assert.equal(w.manager.getSnapshot().active, "primary");
    assert.equal(w.on("local").length, 0);
  });
});

describe("outage handling", () => {
  test("9. GET that times out while Railway is down → fails over and is retried ONCE on local, auth header preserved", async () => {
    const w = await world({ tokens: { accessToken: "tok-1", refreshToken: "r-1" } });
    w.servers[PRIMARY] = () => TIMEOUT;
    w.net.up[PRIMARY] = false;
    w.servers[LOCAL] = () => OK({ stores: ["from-local"] });

    const res = await w.api.get("/stores");
    assert.deepEqual(res.data, { stores: ["from-local"] });
    assert.deepEqual(w.calls.map((c) => c.server), ["primary", "local"]);
    assert.equal(w.calls[1].auth, "Bearer tok-1", "Authorization preserved across the switch");
    assert.equal(w.manager.getSnapshot().active, "local");
  });

  test("Railway edge 404 'Application not found' on a GET is treated as an outage and fails over", async () => {
    const w = await world();
    w.servers[PRIMARY] = () => RAILWAY_EDGE_404;
    w.net.up[PRIMARY] = false;
    const res = await w.api.get("/stores");
    assert.equal(res.status, 200);
    assert.deepEqual(w.calls.map((c) => c.server), ["primary", "local"]);
  });

  test("10. order creation (POST) during an interruption is sent EXACTLY ONCE and never replayed to another server", async () => {
    const w = await world({ tokens: { accessToken: "t", refreshToken: "r" } });
    w.servers[PRIMARY] = () => NETWORK; // connection drops mid-request: it MAY have reached the server
    w.net.up[PRIMARY] = false;

    const err = await rejects(w.api.post("/orders", { storeId: "s1", items: [{ productId: "p1", quantity: 1 }] }));
    assert.equal(err.code, "ERR_NETWORK", "caller sees the real failure");
    await w.clock.settle();

    const posts = w.calls.filter((c) => c.method === "post");
    assert.equal(posts.length, 1, "one attempt in total");
    assert.equal(posts[0].server, "primary");
    assert.equal(w.on("local").length, 0, "local never received the order");
    // …but the NEXT request already goes to the healthy fallback.
    assert.equal(w.manager.getSnapshot().active, "local");
    await w.api.get("/orders");
    assert.equal(w.on("local").at(-1).url, "/orders");
  });

  for (const method of ["put", "patch", "delete"]) {
    test(`${method.toUpperCase()} is not replayed to another server either (one attempt, Railway only)`, async () => {
      const w = await world();
      w.servers[PRIMARY] = () => NETWORK;
      w.net.up[PRIMARY] = false;
      await rejects(w.api[method]("/x", {}));
      await w.clock.settle();
      assert.equal(w.on("primary").length, 1);
      assert.equal(w.on("local").length, 0, "never re-sent to local");
    });
  }

  test("no infinite retry: if the replay on the new endpoint also fails, the error surfaces (2 attempts max)", async () => {
    const w = await world();
    w.servers[PRIMARY] = () => NETWORK;
    w.servers[LOCAL] = () => NETWORK;
    w.net.up[PRIMARY] = false; // probes say local is fine, but its real request fails too
    await rejects(w.api.get("/stores"));
    assert.equal(w.calls.length, 2);
  });

  test("both APIs down: original error surfaces after one attempt; status becomes 'unavailable' (no endpoint switch)", async () => {
    const w = await world();
    w.servers[PRIMARY] = () => NETWORK;
    w.net.up = {};
    const err = await rejects(w.api.get("/stores"));
    assert.equal(err.code, "ERR_NETWORK");
    assert.equal(w.calls.length, 1);
    assert.equal(w.manager.getSnapshot().status, "unavailable");
  });

  test("a request made while the initial endpoint selection is still running waits for it (and goes to the right server)", async () => {
    const w = await world({ up: { [PRIMARY]: false, [LOCAL]: true }, awaitStart: false });
    w.manager.start();
    const res = await w.api.get("/stores"); // fired before selection finished
    assert.equal(res.status, 200);
    assert.deepEqual(w.calls.map((c) => c.server), ["local"]);
  });

  test("release/passive build: never fails over to local, adds no probes on success, surfaces the failure", async () => {
    const w = await world({ failover: false });
    const ok = await w.api.get("/stores");
    assert.equal(ok.status, 200);
    assert.equal(w.net.calls.length, 0, "no probing while healthy");

    w.servers[PRIMARY] = () => NETWORK;
    w.net.up = { [LOCAL]: true };
    await rejects(w.api.get("/stores"));
    await w.clock.settle();
    assert.equal(w.on("local").length, 0);
    assert.equal(w.net.callsTo(LOCAL), 0);
    assert.equal(w.manager.getSnapshot().status, "unavailable");
  });
});

describe("token refresh", () => {
  const expiredThenOk = (server) => {
    let refreshed = false;
    return ({ url, auth }) => {
      if (url === "/auth/refresh") { refreshed = true; return OK({ accessToken: "new-a", refreshToken: "new-r" }); }
      return auth === "Bearer new-a" ? OK({ me: true }) : API_ERR(401, "jwt expired");
    };
  };

  test("11. expired access token: refresh goes to the ACTIVE endpoint (here local), then the request is replayed there", async () => {
    const w = await world({ up: { [PRIMARY]: false, [LOCAL]: true }, tokens: { accessToken: "old", refreshToken: "old-r" } });
    assert.equal(w.manager.getSnapshot().active, "local");
    w.servers[LOCAL] = expiredThenOk();

    const res = await w.api.get("/auth/me");
    assert.deepEqual(res.data, { me: true });
    assert.deepEqual(w.calls.map((c) => `${c.server}:${c.method}:${c.url}`), [
      "local:get:/auth/me", "local:post:/auth/refresh", "local:get:/auth/me",
    ]);
    assert.equal(w.on("primary").length, 0);
    assert.equal(w.auth.setTokensCalls, 1);
    assert.equal(w.auth.accessToken, "new-a");
    assert.equal(w.auth.logoutCalls, 0);
  });

  test("concurrent 401s trigger a single refresh (existing behaviour preserved)", async () => {
    const w = await world({ tokens: { accessToken: "old", refreshToken: "old-r" } });
    w.servers[PRIMARY] = expiredThenOk();
    const [a, b, c] = await Promise.all([w.api.get("/a"), w.api.get("/b"), w.api.get("/c")]);
    assert.ok(a.data.me && b.data.me && c.data.me);
    assert.equal(w.calls.filter((x) => x.url === "/auth/refresh").length, 1);
  });

  test("refresh can't reach the server (outage): the session is KEPT — no forced logout", async () => {
    const w = await world({ tokens: { accessToken: "old", refreshToken: "old-r" } });
    w.servers[PRIMARY] = ({ url }) => (url === "/auth/refresh" ? NETWORK : API_ERR(401, "jwt expired"));
    w.net.up = {};
    const err = await rejects(w.api.get("/auth/me"));
    assert.equal(err.code, "ERR_NETWORK", "connectivity error surfaces, not a fake 'unauthorized'");
    assert.equal(w.auth.logoutCalls, 0);
    assert.equal(w.auth.refreshToken, "old-r");
  });

  test("the API itself rejects the refresh token (revoked/expired): logout, as before", async () => {
    const w = await world({ tokens: { accessToken: "old", refreshToken: "bad-r" } });
    w.servers[PRIMARY] = ({ url }) => (url === "/auth/refresh" ? API_ERR(401, "Invalid refresh token") : API_ERR(401, "jwt expired"));
    await rejects(w.api.get("/auth/me"));
    assert.equal(w.auth.logoutCalls, 1);
    assert.equal(w.net.calls.length, 0, "an application-level 401 never causes a failover probe");
  });
});
