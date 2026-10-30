import Constants from "expo-constants";
import { Platform } from "react-native";
import { resolveApiConfig } from "@/lib/apiConfig";

/**
 * Wires the real environment into the pure resolver in lib/apiConfig.ts.
 * Consumers should not read these directly for request routing — use
 * lib/apiEndpoint.ts, which owns which endpoint is *currently* active.
 *
 * NOTE: `process.env.EXPO_PUBLIC_*` must be referenced literally (not via a
 * variable key) — Expo only inlines the literal form. They are inlined at
 * Metro bundle time, so changing them needs a Metro restart (`npx expo start -c`),
 * NOT a native rebuild.
 */
type Extra = { apiBaseUrl?: string; socketUrl?: string } | undefined;

const config = resolveApiConfig({
  dev: __DEV__,
  platformOS: Platform.OS,
  env: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    localApiUrl: process.env.EXPO_PUBLIC_LOCAL_API_URL,
    apiMode: process.env.EXPO_PUBLIC_API_MODE,
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL,
    localSocketUrl: process.env.EXPO_PUBLIC_LOCAL_SOCKET_URL,
  },
  extra: Constants.expoConfig?.extra as Extra,
  metroHostUri: Constants.expoConfig?.hostUri,
});

export const API_MODE = config.mode;
export const PRIMARY_API_URL = config.primaryUrl;
export const LOCAL_API_URL = config.localUrl;
export const FAILOVER_ENABLED = config.failoverEnabled;
export const PRIMARY_SOCKET_URL = config.primarySocketUrl;
export const LOCAL_SOCKET_URL = config.localSocketUrl;

for (const w of config.warnings) console.warn(`[config] ${w}`);

if (!PRIMARY_API_URL && !LOCAL_API_URL) {
  // Misconfiguration, not a runtime condition: say so loudly instead of
  // letting every request fail with an opaque "Network Error".
  console.error(
    "[config] No API URL resolved. Set EXPO_PUBLIC_API_URL (apps/app/.env.local for local dev, " +
      "or the profile's env block in eas.json) or expo.extra.apiBaseUrl in app.json.",
  );
} else if (__DEV__) {
  console.log(
    `[config] mode=${API_MODE} primary=${PRIMARY_API_URL || "-"} local=${LOCAL_API_URL || "-"} failover=${FAILOVER_ENABLED}`,
  );
}
