import { io, Socket } from "socket.io-client";
import Constants from "expo-constants";
import { useAuthStore } from "@/store/authStore";

// Same resolution order as lib/api.ts — see the comment there.
const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ??
  (Constants.expoConfig?.extra as { socketUrl?: string } | undefined)
    ?.socketUrl ?? "ws://otlob-production-d0da.up.railway.app/realtime";

let socket: Socket | null = null;

/**
 * Lazily creates (or returns) a single shared socket connection,
 * authenticated with the current access token.
 */
export function getSocket(): Socket {
  const { accessToken } = useAuthStore.getState();

  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token: accessToken },
      autoConnect: false,
    });
  }

  // Keep auth payload fresh if the token was refreshed since connect.
  socket.auth = { token: accessToken };

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// --- Typed event helpers -------------------------------------------------

export function subscribeToOrder(orderId: string) {
  getSocket().emit("order:subscribe", { orderId });
}

export function unsubscribeFromOrder(orderId: string) {
  getSocket().emit("order:unsubscribe", { orderId });
}

export function subscribeToStore(storeId: string) {
  getSocket().emit("store:subscribe", { storeId });
}

export function emitDriverLocation(orderId: string, lat: number, lng: number) {
  // orderId is required — the server now verifies the emitting client is
  // actually that order's assigned driver before broadcasting a location
  // update (previously anyone could spoof a location for any order).
  getSocket().emit("driver:location", { orderId, lat, lng });
}
