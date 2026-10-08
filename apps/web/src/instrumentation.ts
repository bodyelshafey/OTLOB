import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Required by current @sentry/nextjs versions to capture errors thrown
// from nested React Server Components — without this export the SDK logs
// a build-time warning that its config is outdated.
export const onRequestError = Sentry.captureRequestError;
