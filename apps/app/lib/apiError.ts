import { endpointManager } from "@/lib/apiEndpoint";
import { classifyFailure } from "@/lib/apiFailure";
import { t } from "@/i18n";

/**
 * Every error the OTLOB API itself returns goes through HttpExceptionFilter and
 * has the shape `{ success: false, statusCode, message, ... }`
 * (see apps/api/src/common/filters/http-exception.filter.ts, README §8.12).
 *
 * A 404/502/503/504 WITHOUT that shape was not produced by our API at all — it
 * came from whatever sits in front of it (e.g. Railway's edge answers
 * `{"status":"error","code":404,"message":"Application not found"}` when the
 * domain isn't attached to a running service). Showing that raw text to a user
 * is misleading, so it is classified separately.
 */
export function isInfrastructureError(err: any): boolean {
  return classifyFailure(err) === "gateway";
}

/** True when no HTTP response arrived at all (DNS, refused, timeout, offline). */
export function isNetworkError(err: any): boolean {
  return !!err && !err.response && !!err.request;
}

/**
 * Human-readable message for any failed API call. Real API errors keep their
 * existing behaviour; infrastructure/network failures get a clear message
 * (with the target URL in development, where it is the first thing you need).
 */
export function getApiErrorMessage(err: any): string {
  if (isInfrastructureError(err)) {
    if (__DEV__) {
      const upstream =
        typeof err.response.data?.message === "string"
          ? ` ("${err.response.data.message}")`
          : "";
      return `The server at ${endpointManager.getBaseUrl()} answered HTTP ${err.response.status}${upstream}, but that response did not come from the OTLOB API. The backend deployment is down or its domain is not attached to a running service.`;
    }
    return t("common.serviceUnavailable");
  }

  if (isNetworkError(err)) {
    return __DEV__
      ? `Could not reach the API at ${endpointManager.getBaseUrl()} (${err.message}). Check that the backend is running and reachable from this device.`
      : t("common.networkError");
  }

  const body = err?.response?.data;
  return (
    (typeof body?.message === "string" && body.message) ||
    (Array.isArray(body?.message) && body.message.join("\n")) ||
    err?.message ||
    t("common.error")
  );
}
