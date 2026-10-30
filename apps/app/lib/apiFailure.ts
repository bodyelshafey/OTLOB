/**
 * Decides whether a failed request says something about the SERVER'S
 * AVAILABILITY (a reason to consider another endpoint) or is just an ordinary
 * application outcome (wrong password, validation error, forbidden, a 500 the
 * API itself reported...). Pure: no React Native imports.
 *
 * Every response the OTLOB API produces carries `{ success:false, statusCode, ... }`
 * (apps/api/src/common/filters/http-exception.filter.ts). A response WITHOUT
 * that shape did not come from our API — it came from whatever sits in front of
 * it (Railway's edge: `{"status":"error","code":404,"message":"Application not found"}`
 * or a 502 "Application failed to respond", a captive portal's HTML, ...).
 */
export type FailureKind =
  | "connection" // no response at all: DNS, refused, offline, TLS
  | "timeout" // no response within the client timeout
  | "gateway" // a response that did not come from the OTLOB API
  | "application" // a genuine API response, including every expected 4xx
  | "cancelled"; // aborted by the caller — says nothing about the server

export function isApiShapedBody(body: unknown): boolean {
  return (
    !!body &&
    typeof body === "object" &&
    typeof (body as { statusCode?: unknown }).statusCode === "number"
  );
}

export function classifyFailure(err: any): FailureKind {
  if (!err) return "application";
  if (err.code === "ERR_CANCELED" || err.name === "CanceledError") return "cancelled";

  const res = err.response;
  if (res) {
    const status: number = res.status;
    if (isApiShapedBody(res.data)) return "application";
    // A 2xx/3xx/other-4xx that isn't API-shaped isn't an availability signal either
    // (e.g. some third-party redirect); only the "server behind the proxy is gone"
    // statuses are.
    if (status === 404 || status >= 500) return "gateway";
    return "application";
  }

  const code: string | undefined = err.code;
  const message: string = String(err.message ?? "");
  if (code === "ECONNABORTED" || code === "ETIMEDOUT" || /timeout/i.test(message)) return "timeout";
  // axios sets `request` when a request was sent but nothing came back.
  return "connection";
}

/** Failure kinds that justify re-evaluating which endpoint to use. */
export function isAvailabilityFailure(kind: FailureKind): boolean {
  return kind === "connection" || kind === "timeout" || kind === "gateway";
}
