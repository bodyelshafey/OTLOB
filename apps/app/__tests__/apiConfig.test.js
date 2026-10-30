const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadFresh } = require("./helpers/tsRequire");
const { resolveApiConfig, metroDerivedLocalApi, deriveSocketUrl } = loadFresh("lib/apiConfig.ts");

const RAILWAY = "https://otlob-railway.example/api";
const base = { dev: true, platformOS: "android", env: {}, extra: {}, metroHostUri: "192.168.1.20:8081" };
const cfg = (o) => resolveApiConfig({ ...base, ...o, env: { ...base.env, ...(o.env ?? {}) } });

describe("development", () => {
  test("auto (default): Railway primary + local derived from the Metro host (no hardcoded IP)", () => {
    const c = cfg({ env: { apiUrl: RAILWAY } });
    assert.equal(c.mode, "auto");
    assert.equal(c.primaryUrl, RAILWAY);
    assert.equal(c.localUrl, "http://192.168.1.20:4000/api");
    assert.equal(c.failoverEnabled, true);
    assert.equal(c.primarySocketUrl, "wss://otlob-railway.example/realtime");
    assert.equal(c.localSocketUrl, "ws://192.168.1.20:4000/realtime");
  });

  test("a LAN-IP change needs no code change: it follows the Metro host", () => {
    assert.equal(cfg({ env: { apiUrl: RAILWAY }, metroHostUri: "10.1.2.3:8081" }).localUrl, "http://10.1.2.3:4000/api");
  });

  test("explicit EXPO_PUBLIC_LOCAL_API_URL wins over Metro derivation", () => {
    const c = cfg({ env: { apiUrl: RAILWAY, localApiUrl: "http://192.168.1.100:4000/api/" } });
    assert.equal(c.localUrl, "http://192.168.1.100:4000/api");
    assert.equal(c.localSocketUrl, "ws://192.168.1.100:4000/realtime");
  });

  test("Android emulator: Metro reporting localhost maps to 10.0.2.2; iOS simulator keeps localhost", () => {
    assert.equal(metroDerivedLocalApi("localhost:8081", "android"), "http://10.0.2.2:4000/api");
    assert.equal(metroDerivedLocalApi("127.0.0.1:8081", "android"), "http://10.0.2.2:4000/api");
    assert.equal(metroDerivedLocalApi("localhost:8081", "ios"), "http://localhost:4000/api");
  });

  test("falls back to app.json extra for the primary when no env var is set", () => {
    const c = cfg({ extra: { apiBaseUrl: RAILWAY, socketUrl: "wss://otlob-railway.example/realtime" } });
    assert.equal(c.primaryUrl, RAILWAY);
    assert.equal(c.primarySocketUrl, "wss://otlob-railway.example/realtime");
  });

  test("a stale extra.socketUrl never overrides an explicit API env var (sockets follow the API host)", () => {
    const c = cfg({ env: { apiUrl: RAILWAY }, extra: { socketUrl: "ws://stale.example/realtime" } });
    assert.equal(c.primarySocketUrl, "wss://otlob-railway.example/realtime");
  });

  test("13. no local URL resolvable (e.g. Metro tunnel) → primary only, failover off", () => {
    const c = cfg({ env: { apiUrl: RAILWAY }, metroHostUri: undefined });
    assert.equal(c.localUrl, "");
    assert.equal(c.failoverEnabled, false);
  });

  test("mode=primary never uses local", () => {
    const c = cfg({ env: { apiUrl: RAILWAY, apiMode: "primary", localApiUrl: "http://192.168.1.100:4000/api" } });
    assert.equal(c.localUrl, "");
    assert.equal(c.failoverEnabled, false);
  });

  test("mode=local uses only local and ignores the primary", () => {
    const c = cfg({ env: { apiUrl: RAILWAY, apiMode: "local" } });
    assert.equal(c.mode, "local");
    assert.equal(c.primaryUrl, "");
    assert.equal(c.localUrl, "http://192.168.1.20:4000/api");
    assert.equal(c.failoverEnabled, false);
  });

  test("mode=local with nothing resolvable degrades to primary with a warning (never to nothing)", () => {
    const c = cfg({ env: { apiUrl: RAILWAY, apiMode: "local" }, metroHostUri: undefined });
    assert.equal(c.primaryUrl, RAILWAY);
    assert.ok(c.warnings.some((w) => /local/i.test(w)));
  });

  test("invalid mode → auto + warning; CRLF-polluted .env values are cleaned", () => {
    const c = cfg({ env: { apiUrl: RAILWAY + "\r", apiMode: "turbo" } });
    assert.equal(c.mode, "auto");
    assert.equal(c.primaryUrl, RAILWAY);
    assert.ok(c.warnings.length >= 1);
  });
});

describe("release builds — production users never depend on a developer machine", () => {
  const release = { dev: false, metroHostUri: "192.168.1.20:8081" };

  test("14. local URL, local mode and Metro host are all ignored; failover is impossible", () => {
    const c = cfg({
      ...release,
      env: { apiUrl: RAILWAY, localApiUrl: "http://192.168.1.100:4000/api", apiMode: "local" },
    });
    assert.equal(c.mode, "primary");
    assert.equal(c.primaryUrl, RAILWAY);
    assert.equal(c.localUrl, "");
    assert.equal(c.localSocketUrl, "");
    assert.equal(c.failoverEnabled, false);
    assert.ok(c.warnings.length >= 1, "tells you the local settings were ignored");
  });

  test("never derives a local URL from the Metro host, even with no env at all", () => {
    const c = cfg({ ...release, extra: { apiBaseUrl: RAILWAY } });
    assert.equal(c.localUrl, "");
    assert.equal(c.primaryUrl, RAILWAY);
  });

  test("the resolved release config contains no localhost / private-network address", () => {
    const c = cfg({
      ...release,
      env: { apiUrl: RAILWAY, localApiUrl: "http://192.168.1.100:4000/api", localSocketUrl: "ws://192.168.1.100:4000/realtime" },
    });
    const blob = JSON.stringify(c);
    assert.doesNotMatch(blob, /localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|(^|[^\d])10\.\d+\.\d+\.\d+/);
  });
});

test("deriveSocketUrl: http(s)://host/api → ws(s)://host/realtime", () => {
  assert.equal(deriveSocketUrl("https://h.example/api"), "wss://h.example/realtime");
  assert.equal(deriveSocketUrl("http://1.2.3.4:4000/api"), "ws://1.2.3.4:4000/realtime");
  assert.equal(deriveSocketUrl(""), "");
});
