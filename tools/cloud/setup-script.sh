#!/bin/bash
set -u

PNPM_VERSION=11.7.0
PLAYWRIGHT_VERSION=1.63.0

# Root installs here; the session user reads the same path.
export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

(
  corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate
) || npm install -g "pnpm@${PNPM_VERSION}" || true &

(
  npx -y "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium &&
    chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH"
) || true &

wait
exit 0
