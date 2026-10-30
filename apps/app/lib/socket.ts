import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/authStore";
import { endpointManager, getActiveSocketUrl } from "@/lib/apiEndpoint";

// The realtime URL follows whichever API lib/apiEndpoint.ts has selected.
//
// IMPORTANT (architecture limit, see README): each API instance has its OWN
// in-memory Socket.IO server (no shared Redis adapter). Moving the app to
// another API moves its realtime connection too, but events emitted by the
// OTHER instance (e.g. an order placed through Railway while this app is on
// the local API) are not delivered to it.

let socket: Socket | null = null;
let connectedUrl = "";
let stopFollowing: (() => void) | null = null;

// Room membership lives on the server and is per-connection: any (re)connect —
// to the same API or a different one — starts with none. Remember what the UI
// asked for and replay it on every connect.
const orderRooms = new Set<string>();
const storeRooms = new Set<string>();

function replayRooms() {
  if (!socket) return;
  orderRooms.forEach((orderId) => socket!.emit("order:subscribe", { orderId }));
  storeRooms.forEach((storeId) => socket!.emit("store:subscribe", { storeId }));
}

/**
 * The active API changed: re-point the SAME Socket at the new server. Keeping
 * the one Socket object (and just changing its Manager's URI) is deliberate —
 * every hook attached its listeners to this object, so they keep working with
 * no re-registration, no duplicate listeners and no second connection.
 */
function followActiveEndpoint() {
  if (!socket) return;
  const next = getActiveSocketUrl();
  if (!next || next === connectedUrl) return;
  connectedUrl = next;
  socket.disconnect();
  // `uri` is private/readonly in socket.io-client's typings, but Manager reads it on
  // every open() to build a fresh engine (verified against 4.8.x). Pinned by
  // __tests__/socket.test.js, which runs two real Socket.IO servers — if a future
  // socket.io-client upgrade breaks this, that test fails.
  (socket.io as unknown as { uri: string }).uri = next;
  socket.connect();
}

/**
 * Lazily creates (or returns) a single shared socket connection,
 * authenticated with the current access token.
 */
export function getSocket(): Socket {
  if (!socket) {
    connectedUrl = getActiveSocketUrl();
    socket = io(connectedUrl, {
      transports: ["websocket"],
      // Evaluated on EVERY (re)connect attempt, so a reconnect after a token
      // refresh — or to a different API — always presents the current token.
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
      autoConnect: false,
      // Own Manager: our URI re-pointing must not leak into socket.io's global cache.
      forceNew: true,
    });
    socket.on("connect", replayRooms);
    stopFollowing = endpointManager.subscribe(followActiveEndpoint);
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  stopFollowing?.();
  stopFollowing = null;
  socket?.disconnect();
  socket = null;
  connectedUrl = "";
  orderRooms.clear();
  storeRooms.clear();
}

// --- Typed event helpers -------------------------------------------------

export function subscribeToOrder(orderId: string) {
  orderRooms.add(orderId);
  const s = getSocket();
  // If not connected yet, the "connect" handler replays it — emitting here too
  // would just double-subscribe.
  if (s.connected) s.emit("order:subscribe", { orderId });
}

export function unsubscribeFromOrder(orderId: string) {
  orderRooms.delete(orderId);
  const s = getSocket();
  if (s.connected) s.emit("order:unsubscribe", { orderId });
}

export function subscribeToStore(storeId: string) {
  storeRooms.add(storeId);
  const s = getSocket();
  if (s.connected) s.emit("store:subscribe", { storeId });
}

export function emitDriverLocation(orderId: string, lat: number, lng: number) {
  // orderId is required — the server now verifies the emitting client is
  // actually that order's assigned driver before broadcasting a location
  // update (previously anyone could spoof a location for any order).
  getSocket().emit("driver:location", { orderId, lat, lng });
}
