const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadFresh } = require("./helpers/tsRequire");
const { classifyFailure, isAvailabilityFailure } = loadFresh("lib/apiFailure.ts");

const res = (status, data) => ({ response: { status, data }, request: {} });
const apiBody = (statusCode, message = "x") => ({ success: false, statusCode, message });

describe("expected application errors must NEVER be treated as server unavailability", () => {
  const cases = [
    ["7. invalid login credentials (401)", res(401, apiBody(401, "Invalid credentials"))],
    ["8. validation error (400)", res(400, apiBody(400, ["phone must be valid"]))],
    ["forbidden (403)", res(403, apiBody(403))],
    ["not found (API-shaped 404)", res(404, apiBody(404, "Cannot GET /api/nope"))],
    ["conflict (409)", res(409, apiBody(409))],
    ["rate limited (429)", res(429, apiBody(429))],
    ["API-shaped 500 (a bug/DB error the API reported itself)", res(500, apiBody(500))],
    ["API-shaped 503", res(503, apiBody(503))],
  ];
  for (const [name, err] of cases) {
    test(name, () => {
      assert.equal(classifyFailure(err), "application");
      assert.equal(isAvailabilityFailure(classifyFailure(err)), false);
    });
  }
});

describe("availability failures", () => {
  test("no response at all → connection", () => {
    assert.equal(classifyFailure({ message: "Network Error", code: "ERR_NETWORK", request: {} }), "connection");
  });
  test("9. request timeout → timeout", () => {
    assert.equal(classifyFailure({ message: "timeout of 15000ms exceeded", code: "ECONNABORTED", request: {} }), "timeout");
    assert.equal(classifyFailure({ message: "x", code: "ETIMEDOUT", request: {} }), "timeout");
  });
  test("Railway edge 'Application not found' (404, not API-shaped) → gateway", () => {
    const e = res(404, { status: "error", code: 404, message: "Application not found", request_id: "abc" });
    assert.equal(classifyFailure(e), "gateway");
    assert.equal(isAvailabilityFailure("gateway"), true);
  });
  test("502/503/504 from a proxy (not API-shaped, incl. HTML bodies) → gateway", () => {
    for (const status of [502, 503, 504]) {
      assert.equal(classifyFailure(res(status, "<html>Bad gateway</html>")), "gateway");
      assert.equal(classifyFailure(res(status, null)), "gateway");
    }
  });
  test("a non-API-shaped 4xx other than 404 is not an availability signal", () => {
    assert.equal(classifyFailure(res(401, "<html>captive portal</html>")), "application");
  });
});

test("caller-cancelled requests say nothing about the server", () => {
  assert.equal(classifyFailure({ code: "ERR_CANCELED", name: "CanceledError" }), "cancelled");
  assert.equal(isAvailabilityFailure("cancelled"), false);
});
