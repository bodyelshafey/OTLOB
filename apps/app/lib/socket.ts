import { io, Socket } from "socket.io-client";
import Constants from "expo-constants";
import { useAuthStore } from "@/store/authStore";

const SOCKET_URL =
  (Constants.expoConfig?.extra as { socketUrl?: string } | undefined)
    ?.socketUrl ?? "wss://otlob-production.up.railway.app/realtime";

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

export function emitDriverLocation(lat: number, lng: number) {
  getSocket().emit("driver:location", { lat, lng });
}
