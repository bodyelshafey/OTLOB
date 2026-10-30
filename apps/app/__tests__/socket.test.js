/**
 * Real Socket.IO end-to-end: the REAL lib/socket.ts + socket.io-client against
 * TWO real Socket.IO servers (standing in for Railway and the local API).
 * Only the auth store and the endpoint-manager signal are faked.
 *
 * Needs the `socket.io` SERVER package, which is an API dependency hoisted to
 * the monorepo root; the suite skips itself (loudly) if it can't be resolved.
 */
const { test, describe, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { ROOT, loadFresh, stub, clearStubs } = require("./helpers/tsRequire");

let Server = null;
try {
  ({ Server } = require(require.resolve("socket.io", { paths: [ROOT] })));
} catch {
  console.warn("[socket.test] socket.io server package not resolvable — skipping");
}

const waitFor = async (cond, what, ms = 8000) => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) assert.fail(`timed out waiting for: ${what}`);
    await new Promise((r) => setTimeout(r, 15));
  }
};

async function startServer(label) {
  const httpServer = http.createServer();
  const io = new Server(httpServer, { transports: ["websocket"] });
  const nsp = io.of("/realtime");
  const s = { label, connections: 0, tokens: [], subscribes: [], live: new Set() };
  nsp.on("connection", (socket) => {
    s.connections++;
    s.tokens.push(socket.handshake.auth.token);
    s.live.add(socket);
    socket.on("order:subscribe", ({ orderId }) => {
      s.subscribes.push(orderId);
      socket.join(`order:${orderId}`);
    });
    socket.on("disconnect", () => s.live.delete(socket));
  });
  await new Promise((r) => httpServer.listen(0, "127.0.0.1", r));
  s.url = `http://127.0.0.1:${httpServer.address().port}/realtime`;
  s.nsp = nsp;
  s.close = () => new Promise((r) => { io.close(); httpServer.closeAllConnections?.(); httpServer.close(() => r()); });
  return s;
}

let cleanup = [];
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn();
  cleanup = [];
});

async function setup() {
  clearStubs();
  const A = await startServer("A");
  const B = await startServer("B");
  cleanup.push(() => A.close(), () => B.close());

  const auth = { accessToken: "token-1" };
  const listeners = new Set();
  let current = A.url;
  stub("@/store/authStore", { useAuthStore: { getState: () => auth } });
  stub("@/lib/apiEndpoint", {
    endpointManager: { subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)) },
    getActiveSocketUrl: () => current,
  });
  const mod = loadFresh("lib/socket.ts");
  cleanup.push(() => mod.disconnectSocket());

  const switchTo = (server) => { current = server.url; [...listeners].forEach((fn) => fn()); };
  return { A, B, auth, mod, switchTo, notify: () => [...listeners].forEach((fn) => fn()), listeners };
}

describe("Socket.IO endpoint switching", { skip: !Server && "socket.io server package unavailable" }, () => {
  test("connects to the active endpoint with the current token; getSocket() is a singleton", async () => {
    const { A, B, mod } = await setup();
    const s = mod.getSocket();
    assert.equal(mod.getSocket(), s);
    assert.equal(mod.getSocket(), s);
    await waitFor(() => s.connected, "connect to A");
    assert.equal(A.connections, 1, "exactly one connection (no duplicates)");
    assert.equal(B.connections, 0);
    assert.deepEqual(A.tokens, ["token-1"]);
  });

  test("12. switching endpoint moves the SAME socket: old server disconnected, new server gets exactly one connection, listeners keep working once", async () => {
    const { A, B, mod, switchTo } = await setup();
    const s = mod.getSocket();
    const received = [];
    s.on("order:status", (p) => received.push(p));
    await waitFor(() => s.connected, "connect to A");

    A.nsp.emit("order:status", { from: "A" });
    await waitFor(() => received.length === 1, "event from A");

    switchTo(B);
    await waitFor(() => B.live.size === 1 && s.connected, "reconnect on B");
    await waitFor(() => A.live.size === 0, "A connection closed");
    assert.equal(mod.getSocket(), s, "same Socket object — hooks' listeners are untouched");
    assert.equal(B.connections, 1);

    B.nsp.emit("order:status", { from: "B" });
    await waitFor(() => received.length === 2, "event from B");
    await new Promise((r) => setTimeout(r, 150));
    assert.deepEqual(received, [{ from: "A" }, { from: "B" }], "each event delivered exactly once — no duplicated listeners");

    A.nsp.emit("order:status", { from: "A-late" });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(received.length, 2, "nothing arrives from the old server anymore");
  });

  test("order/store room subscriptions are replayed on the new server after a switch", async () => {
    const { A, B, mod, switchTo } = await setup();
    const s = mod.getSocket();
    const received = [];
    s.on("order:status", (p) => received.push(p));
    await waitFor(() => s.connected, "connect");
    mod.subscribeToOrder("o1");
    await waitFor(() => A.subscribes.includes("o1"), "A got subscribe");

    switchTo(B);
    await waitFor(() => B.subscribes.includes("o1"), "B got the replayed subscribe");
    B.nsp.to("order:o1").emit("order:status", { orderId: "o1", status: "PREPARING" });
    await waitFor(() => received.length === 1, "room event delivered via B");
  });

  test("subscribing before the connection is up subscribes once (not twice)", async () => {
    const { A, mod } = await setup();
    mod.subscribeToOrder("early"); // socket not connected yet
    await waitFor(() => A.subscribes.length >= 1, "subscribe arrived");
    await new Promise((r) => setTimeout(r, 200));
    assert.deepEqual(A.subscribes, ["early"]);
  });

  test("unsubscribed rooms are NOT replayed after a switch", async () => {
    const { A, B, mod, switchTo } = await setup();
    const s = mod.getSocket();
    await waitFor(() => s.connected, "connect");
    mod.subscribeToOrder("gone");
    mod.unsubscribeFromOrder("gone");
    switchTo(B);
    await waitFor(() => B.live.size === 1, "on B");
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(!B.subscribes.includes("gone"));
  });

  test("12b. a dropped connection auto-reconnects, presents the CURRENT token and re-joins its rooms", async () => {
    const { A, auth, mod } = await setup();
    const s = mod.getSocket();
    await waitFor(() => s.connected, "connect");
    mod.subscribeToOrder("o2");
    await waitFor(() => A.subscribes.length === 1, "initial subscribe");

    auth.accessToken = "token-2"; // e.g. refreshed in the meantime
    [...A.live][0].conn.close(); // network blip: transport dies, server doesn't say goodbye
    await waitFor(() => A.connections === 2 && s.connected, "auto-reconnect", 10_000);

    assert.deepEqual(A.tokens, ["token-1", "token-2"], "reconnect used the fresh token, not the stale one");
    await waitFor(() => A.subscribes.length === 2, "rooms re-joined");
    assert.deepEqual(A.subscribes, ["o2", "o2"]);
  });

  test("a notification that doesn't change the URL (e.g. status flip to 'unavailable') does not reconnect", async () => {
    const { A, mod, notify } = await setup();
    const s = mod.getSocket();
    await waitFor(() => s.connected, "connect");
    notify();
    notify();
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(A.connections, 1);
    assert.equal(A.live.size, 1);
  });

  test("A → B → A: always exactly one live connection, listener still fires once", async () => {
    const { A, B, mod, switchTo } = await setup();
    const s = mod.getSocket();
    let count = 0;
    s.on("ping:test", () => count++);
    await waitFor(() => s.connected, "A");
    switchTo(B);
    await waitFor(() => B.live.size === 1 && A.live.size === 0, "on B");
    switchTo(A);
    await waitFor(() => A.live.size === 1 && B.live.size === 0, "back on A");
    assert.equal(A.connections, 2);
    assert.equal(B.connections, 1);
    A.nsp.emit("ping:test", 1);
    await waitFor(() => count >= 1, "event");
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(count, 1);
  });

  test("disconnectSocket() unsubscribes from endpoint changes (no leaked listener / zombie reconnects)", async () => {
    const { A, B, mod, switchTo, listeners } = await setup();
    const s = mod.getSocket();
    await waitFor(() => s.connected, "connect");
    assert.equal(listeners.size, 1);
    mod.disconnectSocket();
    assert.equal(listeners.size, 0);
    switchTo(B);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(B.connections, 0);
  });
});
