import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

import { DATA_DIR, PORT } from './src/support/env';
import { MCP_SECRET } from './src/support/mcp';

const externalServer = process.env['BASE_URL'];
// The app lives under /notebooks, so specs name full paths (`/notebooks/12`).
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
        command: `pnpm --dir apps/personal-notebook exec next dev -p ${PORT}`,
        url: `http://localhost:${PORT}/notebooks/favicon.ico`,
        reuseExistingServer: false,
        timeout: 180_000,
        cwd: workspaceRoot,
        env: {
          NOTEBOOK_DATA_DIR: DATA_DIR,
          NOTEBOOK_EMBED: 'fake',
          NOTEBOOK_MCP_SECRET: MCP_SECRET,
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
