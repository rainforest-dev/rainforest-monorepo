import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

import { COLLECTIONS_ORIGIN } from './src/support/collections';

const PORT = 3040;
const externalServer = process.env['BASE_URL'];
const baseURL = externalServer ?? `http://127.0.0.1:${PORT}`;

const launchOptions = {
  args: ['--enable-unsafe-swiftshader'],
  // Playwright turns the back/forward cache off by default; the hall is built to be restored from it.
  ignoreDefaultArgs: ['--disable-back-forward-cache'],
};

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'on-first-retry' },
  globalSetup: './src/support/global-setup.ts',
  webServer: externalServer
    ? undefined
    : {
        // A production build: `next dev` sends no-store, which keeps every page out of the bfcache.
        command:
          'pnpm exec nx run library-hall:build && ' +
          `pnpm --dir apps/library-hall exec next start -H 127.0.0.1 -p ${PORT}`,
        url: `${baseURL}/favicon.ico`,
        reuseExistingServer: false,
        timeout: 300_000,
        cwd: workspaceRoot,
        env: {
          LIBRARY_BOOKS_URL: `${COLLECTIONS_ORIGIN}/books`,
          LIBRARY_NOTEBOOKS_URL: `${COLLECTIONS_ORIGIN}/notebooks`,
          LIBRARY_RACK_URL: `${COLLECTIONS_ORIGIN}/rack`,
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions },
      testIgnore: /\.phone\.spec\.ts$/,
    },
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        launchOptions,
      },
      testMatch: /\.phone\.spec\.ts$/,
    },
  ],
});
