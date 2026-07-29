import * as Sentry from '@sentry/astro';

// Browser-side error monitoring. The DSN is public by design (an ingest
// endpoint, not a secret) and is only present in production/preview, where
// `PUBLIC_SENTRY_DSN` is set in Vercel — so local/dev builds stay clean because
// the guard below is falsy. Error monitoring only: performance tracing and
// session replay are opt-in integrations we deliberately omit to keep the
// client bundle small on a personal site.
const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.PUBLIC_VERCEL_ENV ?? import.meta.env.MODE,
    release: import.meta.env.PUBLIC_VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
  });
}
