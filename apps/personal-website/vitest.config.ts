import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Task 8 (2026-07-07 personal-data-library plan) deleted this app's only local test
    // files (mcp/smoke.test.ts, mcp/profile-data.test.ts) — their replacements now live
    // in libs/personal-data, which apps/personal-website consumes rather than defining
    // this logic itself. Zero local test files is the expected steady state here, not a
    // regression, so this shouldn't fail the run.
    passWithNoTests: true,
  },
});
