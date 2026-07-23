import * as Sentry from '@sentry/astro';

// Server-side (SSR) error monitoring. `PUBLIC_SENTRY_DSN` is exposed to both the
// client and server builds by Vite, so the same var drives both configs. Only
// initialises when the DSN is set (production/preview on Vercel). Tracing is
// disabled (tracesSampleRate: 0) — we want error capture, not full APM.
const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.PUBLIC_VERCEL_ENV ?? import.meta.env.MODE,
    release: import.meta.env.PUBLIC_VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
  });
}
