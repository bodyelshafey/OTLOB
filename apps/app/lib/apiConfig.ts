/**
 * Pure resolution of which API(s) the mobile app may talk to. No React Native
 * or Expo imports on purpose, so it can be unit-tested in plain Node.
 * lib/config.ts is the thin wiring that feeds it the real environment.
 *
 * Concepts
 *   primary — the deployed API (Railway). The only API a release build uses.
 *   local   — the API on the developer's computer. Development builds only.
 *
 * EXPO_PUBLIC_API_MODE (development only; release builds always behave as "primary"):
 *   auto     (default) primary first; fall back to local when primary is down and a
 *            local API is reachable; return to primary when it recovers.
 *   primary  only the primary API, never local.
 *   local    only the local API (primary ignored) — "develop against my machine".
 */

export type ApiMode = "auto" | "primary" | "local";

export const LOCAL_API_PORT = 4000;

export interface ApiConfigInput {
  /** `__DEV__` — true for Metro/dev-client sessions, false in release bundles. */
  dev: boolean;
  /** react-native `Platform.OS`. */
  platformOS: string;
  env: {
    apiUrl?: string;
    localApiUrl?: string;
    apiMode?: string;
    socketUrl?: string;
    localSocketUrl?: string;
  };
  /** app.json `expo.extra`. */
  extra?: { apiBaseUrl?: string; socketUrl?: string };
  /** Expo's `expoConfig.hostUri` (the Metro dev server, e.g. "192.168.1.20:8081"). */
  metroHostUri?: string;
}

export interface ApiConfig {
  mode: ApiMode;
  primaryUrl: string;
  localUrl: string;
  /** True only when both URLs exist, we're in development, and mode is "auto". */
  failoverEnabled: boolean;
  primarySocketUrl: string;
  localSocketUrl: string;
  warnings: string[];
}

// `.trim()` also strips a stray "\r" from a .env.local saved with Windows line endings.
export function cleanUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

/** http(s)://host/api  ->  ws(s)://host/realtime */
export function deriveSocketUrl(apiUrl: string): string {
  if (!apiUrl) return "";
  return apiUrl.replace(/^http/, "ws").replace(/\/api$/, "/realtime");
}

/** The machine running Metro, as seen from this device/emulator. */
export function metroDerivedLocalApi(
  metroHostUri: string | undefined,
  platformOS: string,
): string {
  const host = metroHostUri?.split(":")[0]?.trim();
  if (!host) return "";
  const reachable =
    host === "localhost" || host === "127.0.0.1"
      ? platformOS === "android"
        ? "10.0.2.2" // the Android emulator's alias for the host machine
        : "localhost"
      : host;
  return `http://${reachable}:${LOCAL_API_PORT}/api`;
}

function parseMode(raw: string | undefined, warnings: string[]): ApiMode {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "auto";
  if (v === "auto" || v === "primary" || v === "local") return v;
  warnings.push(`Unknown EXPO_PUBLIC_API_MODE "${raw}" — using "auto".`);
  return "auto";
}

export function resolveApiConfig(input: ApiConfigInput): ApiConfig {
  const warnings: string[] = [];
  const { env, extra } = input;

  const envPrimary = cleanUrl(env.apiUrl);
  const primary = envPrimary || cleanUrl(extra?.apiBaseUrl);
  const primarySocket =
    cleanUrl(env.socketUrl) ||
    (envPrimary ? deriveSocketUrl(primary) : cleanUrl(extra?.socketUrl) || deriveSocketUrl(primary));

  // Release builds: production users never depend on a developer machine.
  // Local settings are ignored here no matter what the environment says.
  if (!input.dev) {
    if (cleanUrl(env.localApiUrl) || (env.apiMode ?? "").trim().toLowerCase() === "local") {
      warnings.push("Local API settings are ignored in release builds.");
    }
    return {
      mode: "primary",
      primaryUrl: primary,
      localUrl: "",
      failoverEnabled: false,
      primarySocketUrl: primarySocket,
      localSocketUrl: "",
      warnings,
    };
  }

  const requested = parseMode(env.apiMode, warnings);
  const local =
    cleanUrl(env.localApiUrl) || metroDerivedLocalApi(input.metroHostUri, input.platformOS);
  const localSocket = cleanUrl(env.localSocketUrl) || deriveSocketUrl(local);

  if (requested === "primary") {
    return {
      mode: "primary",
      primaryUrl: primary,
      localUrl: "",
      failoverEnabled: false,
      primarySocketUrl: primarySocket,
      localSocketUrl: "",
      warnings,
    };
  }

  if (requested === "local") {
    if (!local) {
      warnings.push(
        'EXPO_PUBLIC_API_MODE=local but no local API could be resolved (set EXPO_PUBLIC_LOCAL_API_URL) — using the primary API.',
      );
      return {
        mode: "primary",
        primaryUrl: primary,
        localUrl: "",
        failoverEnabled: false,
        primarySocketUrl: primarySocket,
        localSocketUrl: "",
        warnings,
      };
    }
    // Only the local API; the primary is deliberately not configured.
    return {
      mode: "local",
      primaryUrl: "",
      localUrl: local,
      failoverEnabled: false,
      primarySocketUrl: "",
      localSocketUrl: localSocket,
      warnings,
    };
  }

  return {
    mode: "auto",
    primaryUrl: primary,
    localUrl: local,
    failoverEnabled: !!primary && !!local,
    primarySocketUrl: primarySocket,
    localSocketUrl: localSocket,
    warnings,
  };
}
