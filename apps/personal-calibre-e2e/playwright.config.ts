import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

import { APP_DB_PATH, FIXTURES_DIR } from './src/support/seed';

const PORT = 3333;
const externalServer = process.env['BASE_URL'];
const baseURL = externalServer ?? `http://localhost:${PORT}`;

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'on-first-retry' },
  globalSetup: './src/support/global-setup.ts',
  webServer: externalServer
    ? undefined
    : {
        command: `pnpm exec nx dev personal-calibre --port=${PORT}`,
        url: `http://localhost:${PORT}/favicon.ico`,
        reuseExistingServer: false,
        timeout: 180_000,
        cwd: workspaceRoot,
        env: {
          CALIBRE_LIBRARY_PATH: FIXTURES_DIR,
          CALIBRE_APP_DB_PATH: APP_DB_PATH,
          CALIBRE_E2E: '1',
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
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
      },
      testMatch: /\.phone\.spec\.ts$/,
    },
  ],
});
