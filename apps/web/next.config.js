const createNextIntlPlugin = require('next-intl/plugin');
const { withSentryConfig } = require('@sentry/nextjs');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com'
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co'
      }
    ]
  }
};

const configWithIntl = withNextIntl(nextConfig);

// A no-op wrapper (no source map upload, no build-time Sentry calls) unless
// SENTRY_ORG/SENTRY_PROJECT are actually configured — so a build without
// those env vars behaves exactly like it did before Sentry was added,
// instead of failing trying to reach Sentry's API.
module.exports = process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
  ? withSentryConfig(configWithIntl, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: false,
      disableLogger: true,
      // Only actually uploads source maps in CI (needs SENTRY_AUTH_TOKEN)
      // — a plain local build still works without one.
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
    })
  : configWithIntl;