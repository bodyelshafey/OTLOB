const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadFresh } = require("./helpers/tsRequire");
const { FakeClock, FakeNetwork } = require("./helpers/fakeClock");

const { EndpointManager } = loadFresh("lib/endpointManager.ts");

const PRIMARY = "https://otlob-railway.example/api";
const LOCAL = "http://10.0.2.2:4000/api";

function make({ up = {}, failoverEnabled = true, primaryUrl = PRIMARY, localUrl = LOCAL, tuning } = {}) {
  const clock = new FakeClock();
  const net = new FakeNetwork(up);
  const manager = new EndpointManager({
    primaryUrl,
    localUrl,
    failoverEnabled,
    probe: net.probe,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    sleep: clock.sleep,
    tuning,
  });
  const changes = [];
  manager.subscribe(() => {
    const s = manager.getSnapshot();
    changes.push(`${s.status}:${s.active}`);
  });
  return { manager, clock, net, changes };
}

const snap = (m) => m.getSnapshot();

describe("startup selection", () => {
  test("1. Railway healthy + local available → Railway; local is never probed", async () => {
    const { manager, net } = make({ up: { [PRIMARY]: true, [LOCAL]: true } });
    await manager.start();
    assert.equal(snap(manager).status, "ready");
    assert.equal(snap(manager).active, "primary");
    assert.equal(manager.getBaseUrl(), PRIMARY);
    assert.deepEqual(net.calls, [PRIMARY]);
  });

  test("2. Railway healthy + local unavailable → Railway", async () => {
    const { manager } = make({ up: { [PRIMARY]: true, [LOCAL]: false } });
    await manager.start();
    assert.equal(manager.getBaseUrl(), PRIMARY);
    assert.equal(snap(manager).onFallback, false);
  });

  test("3. Railway down + local available → local, flagged as fallback", async () => {
    const { manager, net } = make({ up: { [PRIMARY]: false, [LOCAL]: true } });
    await manager.start();
    assert.equal(snap(manager).status, "ready");
    assert.equal(snap(manager).active, "local");
    assert.equal(snap(manager).onFallback, true);
    assert.equal(manager.getBaseUrl(), LOCAL);
    assert.deepEqual(net.calls, [PRIMARY, LOCAL]);
  });

  test("4. both unavailable → 'unavailable' (not stuck), requests still have a target, manual retry works", async () => {
    const { manager, net } = make({ up: {} });
    await manager.start();
    assert.equal(snap(manager).status, "unavailable");
    assert.equal(manager.getBaseUrl(), PRIMARY, "keeps a base URL so requests can still be attempted");

    net.up[LOCAL] = true;
    await manager.retry();
    assert.equal(snap(manager).status, "ready");
    assert.equal(snap(manager).active, "local");
  });

  test("ensureReady() waits for the initial selection and always resolves (even when everything is down)", async () => {
    const clock = new FakeClock();
    let release;
    const gate = new Promise((r) => (release = r));
    const manager = new EndpointManager({
      primaryUrl: PRIMARY, localUrl: LOCAL, failoverEnabled: true,
      probe: async () => { await gate; return false; },
      now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, sleep: clock.sleep,
    });
    void manager.start();
    let ready = false;
    void manager.ensureReady().then(() => (ready = true));
    await clock.settle();
    assert.equal(ready, false, "must not resolve while probing");
    release();
    await clock.settle();
    assert.equal(ready, true);
    assert.equal(snap(manager).status, "unavailable");
  });
});

describe("recovery back to Railway", () => {
  async function onFallback(tuning) {
    const ctx = make({ up: { [PRIMARY]: false, [LOCAL]: true }, tuning });
    await ctx.manager.start();
    assert.equal(snap(ctx.manager).active, "local");
    return ctx;
  }

  test("5. returns to Railway after 2 consecutive healthy probes + dwell time, then stops polling", async () => {
    const { manager, clock, net } = await onFallback();
    net.up[PRIMARY] = true;
    await clock.advance(15_000);
    assert.equal(snap(manager).active, "local", "one healthy probe is not enough");
    await clock.advance(15_000);
    assert.equal(snap(manager).active, "primary");
    assert.equal(snap(manager).status, "ready");
    assert.equal(clock.pending, 0, "no background polling once back on a healthy Railway");
  });

  test("does not flap: an intermittent Railway never accumulates the required consecutive successes", async () => {
    const { manager, clock, net } = await onFallback({ recoveryIntervalsMs: [1_000], minDwellMs: 0 });
    for (let i = 0; i < 6; i++) {
      net.up[PRIMARY] = i % 2 === 0; // ok, fail, ok, fail ...
      await clock.advance(1_000);
    }
    assert.equal(snap(manager).active, "local");
  });

  test("minimum dwell: even two healthy probes don't move us back before minDwellMs", async () => {
    const { manager, clock, net } = await onFallback({ recoveryIntervalsMs: [1_000], minDwellMs: 30_000 });
    net.up[PRIMARY] = true;
    await clock.advance(5_000);
    assert.equal(snap(manager).active, "local");
    await clock.advance(25_000);
    assert.equal(snap(manager).active, "primary");
  });

  test("recovery polling backs off (15s → 30s → 60s) while Railway stays down — bounded, battery-friendly", async () => {
    const { clock, net } = await onFallback();
    const base = net.calls.length;
    await clock.advance(15_000); // 1st poll
    await clock.advance(30_000); // 2nd
    await clock.advance(60_000); // 3rd
    await clock.advance(60_000); // 4th (cap)
    assert.equal(net.calls.length - base, 4);
    await clock.advance(10 * 60_000); // 10 more minutes → at most ~10 more probes, never a tight loop
    assert.ok(net.calls.length - base <= 4 + 10);
  });

  test("polling pauses in the background and checks immediately on returning to the foreground", async () => {
    const { manager, clock, net } = await onFallback();
    manager.setForeground(false);
    const before = net.calls.length;
    await clock.advance(10 * 60_000);
    assert.equal(net.calls.length, before, "no probes while backgrounded");
    assert.equal(clock.pending, 0);

    net.up[PRIMARY] = true;
    manager.setForeground(true);
    await clock.advance(0);
    assert.ok(net.calls.length > before, "immediate check on resume");
  });
});

describe("runtime failures", () => {
  test("7. a single failed request on a healthy Railway does NOT switch (probes decide, not one request)", async () => {
    const { manager, net, clock } = make({ up: { [PRIMARY]: true, [LOCAL]: true } });
    await manager.start();
    net.calls.length = 0;
    const p = manager.reportFailure();
    await clock.advance(5_000);
    await p;
    assert.equal(snap(manager).active, "primary");
    assert.equal(snap(manager).status, "ready");
  });

  test("Railway dies at runtime → needs 2 failed probes, then moves to local", async () => {
    const { manager, net, clock } = make({ up: { [PRIMARY]: true, [LOCAL]: true } });
    await manager.start();
    net.up[PRIMARY] = false;
    net.calls.length = 0;
    const p = manager.reportFailure();
    await clock.advance(2_000); // confirm delay
    await p;
    assert.equal(net.callsTo(PRIMARY), 2, "confirmed before leaving Railway");
    assert.equal(snap(manager).active, "local");
  });

  test("a burst of failures causes ONE re-check (single-flight), then the cooldown suppresses more", async () => {
    const { manager, net, clock } = make({ up: { [PRIMARY]: true, [LOCAL]: true } });
    await manager.start();
    net.calls.length = 0;
    await Promise.all([manager.reportFailure(), manager.reportFailure(), manager.reportFailure()]);
    await clock.advance(5_000);
    const firstWave = net.calls.length;
    assert.ok(firstWave >= 1 && firstWave <= 2);

    await manager.reportFailure(); // inside the 10s cooldown
    assert.equal(net.calls.length, firstWave, "cooldown: no new probes");

    await clock.advance(11_000);
    await manager.reportFailure();
    assert.ok(net.calls.length > firstWave, "after the cooldown a re-check is allowed again");
  });

  test("local fallback dying → re-evaluates and prefers a healthy Railway", async () => {
    const { manager, net, clock } = make({ up: { [PRIMARY]: false, [LOCAL]: true } });
    await manager.start();
    assert.equal(snap(manager).active, "local");
    net.up[LOCAL] = false;
    net.up[PRIMARY] = true;
    await clock.advance(11_000);
    const p = manager.reportFailure();
    await clock.advance(2_000);
    await p;
    assert.equal(snap(manager).active, "primary");
  });

  test("6. device loses connectivity: both fail → 'unavailable'; recovers on its own when the network returns", async () => {
    const { manager, net, clock, changes } = make({ up: { [PRIMARY]: true, [LOCAL]: false } });
    await manager.start();
    net.up[PRIMARY] = false;
    const p = manager.reportFailure();
    await clock.advance(5_000);
    await p;
    assert.equal(snap(manager).status, "unavailable");

    net.up[PRIMARY] = true; // wifi is back — nobody touches the app
    await clock.advance(15_000);
    assert.equal(snap(manager).status, "ready");
    assert.equal(snap(manager).active, "primary");
    assert.deepEqual(changes, ["ready:primary", "unavailable:primary", "ready:primary"]);
  });

  test("reportSuccess() after 'unavailable' restores 'ready' (a real response proves the endpoint works)", async () => {
    const { manager, clock } = make({ up: {} });
    await manager.start();
    assert.equal(snap(manager).status, "unavailable");
    manager.reportSuccess();
    assert.equal(snap(manager).status, "ready");
    await clock.settle();
  });
});

describe("modes where failover must not happen", () => {
  test("13. app starts without a configured local API URL → Railway only, local never probed, no startup probing", async () => {
    const { manager, net, clock } = make({ up: { [PRIMARY]: true }, localUrl: "" });
    await manager.start();
    assert.equal(snap(manager).failoverEnabled, false);
    assert.equal(snap(manager).status, "ready");
    assert.equal(manager.getBaseUrl(), PRIMARY);
    assert.deepEqual(net.calls, []);
    assert.equal(clock.pending, 0);
  });

  test("14. release-style passive mode: zero background traffic while healthy", async () => {
    const { manager, net, clock } = make({ up: { [PRIMARY]: true, [LOCAL]: true }, failoverEnabled: false });
    await manager.start();
    await clock.advance(60 * 60_000);
    assert.deepEqual(net.calls, [], "a healthy production app never polls");
    assert.equal(manager.getBaseUrl(), PRIMARY);
  });

  test("passive mode never fails over to local even if local is up; reports 'unavailable' and recovers", async () => {
    const { manager, net, clock } = make({ up: { [PRIMARY]: false, [LOCAL]: true }, failoverEnabled: false });
    await manager.start();
    const p = manager.reportFailure();
    await clock.advance(5_000);
    await p;
    assert.equal(snap(manager).status, "unavailable");
    assert.equal(snap(manager).active, "primary");
    assert.equal(net.callsTo(LOCAL), 0, "local is never contacted in passive mode");

    net.up[PRIMARY] = true;
    await clock.advance(15_000);
    assert.equal(snap(manager).status, "ready");
  });

  test("local-only mode (no primary configured) uses local and never invents a fallback", async () => {
    const { manager, net } = make({ up: { [LOCAL]: true }, primaryUrl: "", failoverEnabled: false });
    await manager.start();
    assert.equal(manager.getBaseUrl(), LOCAL);
    assert.equal(snap(manager).onFallback, false, "explicit local mode is not a 'fallback'");
    assert.deepEqual(net.calls, []);
  });

  test("a throwing probe is treated as 'unhealthy', never as an unhandled rejection", async () => {
    const clock = new FakeClock();
    const manager = new EndpointManager({
      primaryUrl: PRIMARY, localUrl: LOCAL, failoverEnabled: true,
      probe: async () => { throw new Error("boom"); },
      now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, sleep: clock.sleep,
    });
    await manager.start();
    assert.equal(snap(manager).status, "unavailable");
    manager.dispose();
  });
});
