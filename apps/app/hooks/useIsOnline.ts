import { useApiEndpoint } from "@/lib/apiEndpoint";

/**
 * "Can the app reach an API right now?" — derived from the shared endpoint
 * state in lib/apiEndpoint.ts instead of polling /health on its own timer.
 * That removes a competing health-check loop (it used to fetch /health every
 * 10 seconds, forever, against a fixed URL — including in release builds) and
 * guarantees this indicator can never disagree with where requests are
 * actually being sent. Detection is event-driven: real request failures and
 * the manager's foreground-only recovery checks.
 */
export function useIsOnline(): boolean {
  return useApiEndpoint((s) => s.status !== "unavailable");
}
