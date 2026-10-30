import { AppState } from "react-native";
import { create } from "zustand";
import {
  API_MODE,
  FAILOVER_ENABLED,
  LOCAL_API_URL,
  LOCAL_SOCKET_URL,
  PRIMARY_API_URL,
  PRIMARY_SOCKET_URL,
} from "@/lib/config";
import { EndpointManager, type EndpointSnapshot } from "@/lib/endpointManager";
import { probeHealth } from "@/lib/healthProbe";

/**
 * The app-wide singleton that answers "which API do I talk to right now?".
 * lib/api.ts (REST) and lib/socket.ts (realtime) both read from it, so the two
 * can never disagree. Its UI-facing state is mirrored into a zustand store —
 * the same state-management library the rest of the app already uses.
 */

// Primary gets a longer budget (cold Railway instance / mobile network); the
// local candidate sits on the same LAN, so it either answers fast or not at all.
const PRIMARY_PROBE_MS = 4_000;
const LOCAL_PROBE_MS = 2_500;

export const endpointManager = new EndpointManager({
  primaryUrl: PRIMARY_API_URL,
  localUrl: LOCAL_API_URL,
  failoverEnabled: FAILOVER_ENABLED,
  probe: (url) =>
    probeHealth(url, { timeoutMs: url === PRIMARY_API_URL ? PRIMARY_PROBE_MS : LOCAL_PROBE_MS }),
});

/** Reactive view for components (banner, offline indicator). */
export const useApiEndpoint = create<EndpointSnapshot>(() => endpointManager.getSnapshot());
endpointManager.subscribe(() => useApiEndpoint.setState(endpointManager.getSnapshot()));

/** WebSocket URL of whichever endpoint is currently active. */
export function getActiveSocketUrl(): string {
  const { active } = endpointManager.getSnapshot();
  return active === "local" ? LOCAL_SOCKET_URL : PRIMARY_SOCKET_URL;
}

// Recovery polling only runs while the app is foregrounded (battery).
AppState.addEventListener("change", (state) => {
  endpointManager.setForeground(state === "active");
});

// Kick off the initial selection as soon as anything imports this module, so
// the very first request already waits for it (see lib/api.ts → ensureReady()).
void endpointManager.start();

if (__DEV__) {
  console.log(
    `[endpoint] mode=${API_MODE} active=${endpointManager.getSnapshot().active} ` +
      `(${endpointManager.getBaseUrl() || "none"})`,
  );
  endpointManager.subscribe(() => {
    const s = endpointManager.getSnapshot();
    console.log(`[endpoint] status=${s.status} active=${s.active} → ${s.baseUrl || "none"}`);
  });
}
