/**
 * Scenario 14 (static half): nothing that EAS bakes into a release build may
 * point at a developer machine, and the local-only settings must not be
 * configurable for release profiles at all.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("./helpers/tsRequire");

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const DEV_MACHINE = /localhost|127\.0\.0\.1|10\.0\.2\.2|10\.0\.3\.2|192\.168\.\d+\.\d+|(?<![\d.])10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\.local(:|\/|$)/;

describe("eas.json release profiles", () => {
  const eas = JSON.parse(read("eas.json"));
  const releaseProfiles = Object.entries(eas.build).filter(([name]) => name !== "development");

  test("there is at least one release profile to check", () => {
    assert.ok(releaseProfiles.length >= 1);
  });

  for (const [name, profile] of releaseProfiles) {
    test(`profile "${name}": API/socket URLs are https/wss and never a dev machine`, () => {
      const env = profile.env ?? {};
      for (const key of ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_SOCKET_URL"]) {
        if (env[key] === undefined) continue;
        assert.doesNotMatch(env[key], DEV_MACHINE, `${key} must not point at a dev machine`);
        assert.match(env[key], key.endsWith("SOCKET_URL") ? /^wss:\/\// : /^https:\/\//, `${key} must be TLS`);
      }
    });

    test(`profile "${name}": local-only settings are not set`, () => {
      const env = profile.env ?? {};
      assert.equal(env.EXPO_PUBLIC_LOCAL_API_URL, undefined);
      assert.equal(env.EXPO_PUBLIC_LOCAL_SOCKET_URL, undefined);
      assert.ok(!env.EXPO_PUBLIC_API_MODE || env.EXPO_PUBLIC_API_MODE === "primary");
    });
  }
});

test("app.json extra (the static fallback baked into every build) has no dev-machine address", () => {
  const extra = JSON.parse(read("app.json")).expo.extra ?? {};
  for (const value of [extra.apiBaseUrl, extra.socketUrl]) {
    assert.ok(value, "fallback is configured");
    assert.doesNotMatch(value, DEV_MACHINE);
  }
  assert.match(extra.apiBaseUrl, /^https:\/\//);
  assert.match(extra.socketUrl, /^wss:\/\//);
});

test("app.json does not enable cleartext HTTP for release builds", () => {
  const cfg = JSON.parse(read("app.json")).expo;
  assert.notEqual(cfg.android?.usesCleartextTraffic, true);
  const plugins = JSON.stringify(cfg.plugins ?? []);
  assert.doesNotMatch(plugins, /usesCleartextTraffic/);
});

test("committed .env.example: every ACTIVE (uncommented) variable is a safe, non-dev value", () => {
  const active = read(".env.example").split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  for (const line of active) {
    const [key, ...rest] = line.split("=");
    if (/LOCAL/.test(key)) assert.fail(`${key} must stay commented out in .env.example`);
    assert.doesNotMatch(rest.join("="), DEV_MACHINE);
  }
});

test("no EXPO_PUBLIC_ variable in any committed config carries a secret-looking name", () => {
  const blob = read("eas.json") + read(".env.example");
  const names = [...blob.matchAll(/EXPO_PUBLIC_[A-Z0-9_]+/g)].map((m) => m[0]);
  for (const n of names) assert.doesNotMatch(n, /SECRET|SERVICE_ROLE|PASSWORD|PRIVATE|DATABASE|JWT/);
});
