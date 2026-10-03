import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

import { VAULT_DIR } from './src/support/vault';

const PORT = 3032;
const externalServer = process.env['BASE_URL'];
const baseURL = externalServer ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'on-first-retry' },
  globalSetup: './src/support/global-setup.ts',
  webServer: externalServer
    ? undefined
    : {
        command:
          'pnpm exec nx run-many -t build -p rainforest-ui rainforest-react && ' +
          // Astro backgrounds `astro dev` when it detects an agent; --ignore-lock keeps it in the foreground.
          `pnpm --dir apps/rss-manager exec astro dev --host 127.0.0.1 --port ${PORT} --ignore-lock`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180_000,
        cwd: workspaceRoot,
        env: { VAULT_PATH: VAULT_DIR },
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
