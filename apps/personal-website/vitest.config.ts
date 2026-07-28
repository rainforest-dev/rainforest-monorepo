import { getViteConfig } from 'astro/config';

// getViteConfig (not plain vitest/config's defineConfig) because src/mcp/profile.ts — pulled
// in transitively by any test that imports src/mcp/handler.ts — has top-level imports of the
// `astro:content` virtual module and tsconfig path aliases (`@utils/*`, `@types`). Those only
// resolve through Astro's own Vite config; plain vitest/config has neither, and fails with
// "Failed to resolve import" before a single test runs.
export default getViteConfig({
  test: {
    // jsdom rather than node: the on-device AI capability core (src/utils/ai/) caches a
    // failed capability probe in sessionStorage, which node's environment doesn't provide.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // Task 8 (2026-07-07 personal-data-library plan) deleted this app's only local test
    // files (mcp/smoke.test.ts, mcp/profile-data.test.ts) — their replacements now live
    // in libs/personal-data, which apps/personal-website consumes rather than defining
    // this logic itself. Zero local test files was the steady state here until this
    // catalog.test.ts, so passWithNoTests still guards a future regression to that state.
    passWithNoTests: true,
  },
});
