import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";
import { endpointManager } from "@/lib/apiEndpoint";
import { classifyFailure, isAvailabilityFailure } from "@/lib/apiFailure";

// Which API a request goes to is decided by lib/apiEndpoint.ts (primary/Railway,
// with an optional development-only local fallback — see README). No URL or LAN
// IP is hardcoded here, and the base URL is stamped per request, not per
// instance, so a failover takes effect on the very next request.

export const api = axios.create({
  baseURL: endpointManager.getBaseUrl(),
  timeout: 15000,
});

// Failover never re-sends a request that might already have been processed.
// Only methods that are safe to repeat may be retried on another endpoint;
// POST/PUT/PATCH/DELETE (order creation, payments, registration, ...) are
// reported to the caller as-is, exactly once.
const REPLAYABLE_METHODS = new Set(["get", "head", "options"]);

type RetryableConfig = AxiosRequestConfig & { _retry?: boolean; _failoverRetried?: boolean };

// Route to the currently selected endpoint and attach the bearer token.
api.interceptors.request.use(async (config) => {
  // Bounded wait for the initial endpoint selection (no-op in release builds).
  await endpointManager.ensureReady();
  config.baseURL = endpointManager.getBaseUrl();

  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Retry once on 401 using the refresh token; force-logout on repeated failure.
// Mirrors the web app's lib/api.ts refresh flow.
let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function resolveQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

/**
 * A request failed in a way that says "the server may be unavailable".
 * Asks the endpoint manager to re-check; if that moved us to a different
 * endpoint AND the request is safe to repeat, returns the retried request.
 * Otherwise returns null and the original error is surfaced untouched.
 */
async function recoverFromAvailabilityFailure(req: RetryableConfig | undefined) {
  const canReplay =
    !!req &&
    !req._failoverRetried &&
    endpointManager.getSnapshot().failoverEnabled &&
    REPLAYABLE_METHODS.has((req.method ?? "get").toLowerCase());

  if (!canReplay) {
    // Don't make the caller wait on a health check that can't change the outcome.
    void endpointManager.reportFailure();
    return null;
  }

  const before = endpointManager.getBaseUrl();
  await endpointManager.reportFailure();
  if (endpointManager.getBaseUrl() === before) return null;

  req!._failoverRetried = true;
  return api(req!);
}

api.interceptors.response.use(
  (response) => {
    endpointManager.reportSuccess();
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;
    const kind = classifyFailure(error);

    // Any real API answer (even 401/403/422/500) proves the server is reachable —
    // wrong passwords and validation errors are NOT reasons to change endpoint.
    if (kind === "application") endpointManager.reportSuccess();

    if (isAvailabilityFailure(kind)) {
      const retried = await recoverFromAvailabilityFailure(originalRequest);
      if (retried) return retried;
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      const { refreshToken, setTokens, logout } = useAuthStore.getState();

      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        // Wait for the in-flight refresh to finish, then retry.
        return new Promise((resolve, reject) => {
          pendingQueue.push((token) => {
            if (!token) return reject(error);
            originalRequest.headers = {
              ...(originalRequest.headers ?? {}),
              Authorization: `Bearer ${token}`,
            };
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      try {
        // Bare axios (no interceptors, so no loops) — but against the ACTIVE
        // endpoint, not a fixed URL. Refresh tokens live in the shared database,
        // so either API can validate them provided both use the same JWT secrets.
        const { data } = await axios.post(
          `${endpointManager.getBaseUrl()}/auth/refresh`,
          { refreshToken },
          { timeout: 15000 },
        );
        setTokens(data.accessToken, data.refreshToken);
        resolveQueue(data.accessToken);
        originalRequest.headers = {
          ...(originalRequest.headers ?? {}),
          Authorization: `Bearer ${data.accessToken}`,
        };
        return api(originalRequest);
      } catch (refreshError) {
        resolveQueue(null);
        if (isAvailabilityFailure(classifyFailure(refreshError))) {
          // The server couldn't be reached — that says nothing about whether the
          // refresh token is valid. Keep the session (do NOT log the user out)
          // and let the connectivity error surface; the next request refreshes.
          void endpointManager.reportFailure();
          return Promise.reject(refreshError);
        }
        // The API itself rejected the refresh token: the session is really over.
        logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
