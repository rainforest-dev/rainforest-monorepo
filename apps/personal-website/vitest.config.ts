import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom rather than node: the on-device AI capability core (src/utils/ai/) caches a
    // failed capability probe in sessionStorage, which node's environment doesn't provide.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Task 8 (2026-07-07 personal-data-library plan) deleted this app's only local test
    // files (mcp/smoke.test.ts, mcp/profile-data.test.ts) — their replacements now live
    // in libs/personal-data, which apps/personal-website consumes rather than defining
    // this logic itself. Zero local test files is the expected steady state here, not a
    // regression, so this shouldn't fail the run.
    passWithNoTests: true,
  },
});
