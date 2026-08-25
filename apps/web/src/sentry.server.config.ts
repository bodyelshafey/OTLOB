import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    beforeSend(event) {
      // Auth cookies/headers must never leave the server, even to an
      // error-tracking service.
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
