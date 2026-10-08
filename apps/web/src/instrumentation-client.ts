import * as Sentry from '@sentry/nextjs';

// A no-op when NEXT_PUBLIC_SENTRY_DSN isn't set — keeps local dev and any
// environment that hasn't configured Sentry yet working exactly as before.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Conservative default for a marketplace app this size — raise later
    // with actual evidence it's needed, not by default.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    // No session replay — it's the highest-risk feature for accidentally
    // capturing sensitive on-screen data (addresses, phone numbers, cart
    // contents) and isn't something this phase asked for.
  });
}
