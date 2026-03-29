/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained build for Docker deployment
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
}

const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(nextConfig, {
  // Sentry org/project for source map uploads (set in CI environment)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Suppress build output unless running in CI
  silent: !process.env.CI,
  // Upload source maps for better stack traces in Sentry
  widenClientFileUpload: true,
  // Route Sentry requests through a tunnel to avoid ad-blockers
  tunnelRoute: '/monitoring',
  // Suppress Sentry SDK logger in production bundles
  disableLogger: true,
});
