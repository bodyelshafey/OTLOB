import { isApiShapedBody } from "@/lib/apiFailure";

/**
 * Asks an API "can you serve requests right now?". Used only by the endpoint
 * manager, and deliberately NOT via the axios client — a probe must not carry
 * auth headers, trigger token refresh, or be re-routed by the failover logic
 * it is feeding.
 *
 * Preferred check: GET {base}/health/ready  (200 + { status:"ok", service:"otlob-api" })
 * Older deployments (before /health/ready existed) answer that route with an
 * API-shaped 404; for those we fall back to the legacy GET {base}/health
 * (200 + { status:"ok" }). A Railway-edge 404 ("Application not found") is NOT
 * API-shaped and is therefore never mistaken for "an old API" — it means down.
 */
export interface ProbeOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface Reply {
  status: number;
  body: unknown;
}

async function getJson(url: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<Reply | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return null; // refused / DNS / offline / aborted by timeout
  } finally {
    clearTimeout(timer);
  }
}

const isOk = (b: unknown) => !!b && typeof b === "object" && (b as { status?: unknown }).status === "ok";

export async function probeHealth(baseUrl: string, opts: ProbeOptions = {}): Promise<boolean> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = baseUrl.replace(/\/+$/, "");

  const ready = await getJson(`${base}/health/ready`, timeoutMs, fetchImpl);
  if (!ready) return false;

  if (ready.status === 200) {
    return isOk(ready.body) && (ready.body as { service?: unknown }).service === "otlob-api";
  }
  if (ready.status === 404 && isApiShapedBody(ready.body)) {
    const legacy = await getJson(`${base}/health`, timeoutMs, fetchImpl);
    return !!legacy && legacy.status === 200 && isOk(legacy.body);
  }
  return false; // 503 (dependency down), gateway errors, anything else
}
