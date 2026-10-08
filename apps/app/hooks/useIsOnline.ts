import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api";

/**
 * NOTE: for production, install `@react-native-community/netinfo` and
 * replace this with its `useNetInfo()` hook — it gives instant, event-driven
 * connectivity changes instead of this fetch-based fallback probe.
 *
 *   npx expo install @react-native-community/netinfo
 *
 *   import NetInfo from "@react-native-community/netinfo";
 *   export function useIsOnline() {
 *     const [online, setOnline] = useState(true);
 *     useEffect(() => NetInfo.addEventListener(s => setOnline(!!s.isConnected)), []);
 *     return online;
 *   }
 */
export function useIsOnline(pollMs = 10000) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        // Use the same base URL the rest of the app talks to (Railway in
        // production, LAN IP in local dev) instead of a separate hardcoded
        // address — otherwise this probe reports "offline" in production
        // even when the real API is reachable.
        await fetch(`${API_BASE_URL}/health`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!cancelled) setOnline(true);
      } catch {
        if (!cancelled) setOnline(false);
      }
    }

    check();
    const interval = setInterval(check, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pollMs]);

  return online;
}
