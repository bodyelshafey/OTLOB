import * as Sentry from '@sentry/node';

// Imported as the very first line of main.ts, before any other module
// loads — Sentry's Node SDK needs to initialize before other modules are
// required to correctly auto-instrument things like outgoing HTTP calls.
// A no-op when SENTRY_DSN isn't set, so nothing breaks in local dev or in
// an environment that hasn't configured Sentry yet.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    // Conservative default — full tracing on every request is expensive
    // and not needed for a marketplace API of this size; can be raised
    // later with actual evidence it's needed.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    beforeSend(event) {
      // Auth headers and cookies must never leave the server, even to an
      // error-tracking service — strip them from whatever Sentry captured
      // before it's sent.
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, unknown>;
        delete headers['authorization'];
        delete headers['Authorization'];
        delete headers['cookie'];
        delete headers['Cookie'];
      }
      if (event.request) {
        delete event.request.cookies;
      }
      return event;
    },
  });
}
