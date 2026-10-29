import { defineConfig, devices } from '@playwright/test';

const gallery = 'http://localhost:3100/playwright/gallery/index.html';

/**
 * Component tests against the story gallery (`playwright/gallery`): each `mount()` renders one
 * `src/**\/*.story.tsx` export in a real browser with the shell's real Tailwind CSS.
 */
export default defineConfig({
  testDir: './playwright',
  testMatch: '**/*.spec.ts',
  outputDir: '../../dist/.playwright/libs/library-shell',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: gallery,
    serviceWorkers: 'block',
    reuseContext: true,
  },
  webServer: {
    command: 'pnpm exec vite --config playwright/vite.config.ts',
    url: gallery,
    reuseExistingServer: !process.env['CI'],
  },
});
