import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env['BASE_URL'] || 'http://localhost:3333';
const fixturesDir = path.join(__dirname, 'src/fixtures');

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  globalSetup: './src/support/global-setup.ts',
  webServer: {
    command: 'pnpm exec nx dev personal-calibre',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
    env: {
      CALIBRE_LIBRARY_PATH: fixturesDir,
      CALIBRE_APP_DB_PATH: path.join(fixturesDir, 'app.db'),
      PORT: '3333',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
