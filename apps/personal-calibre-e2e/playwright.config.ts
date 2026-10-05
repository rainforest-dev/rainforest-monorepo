import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';

import { MCP_SECRET } from './src/support/mcp';
import { APP_DB_PATH, FIXTURES_DIR } from './src/support/seed';

const PORT = 3333;
const externalServer = process.env['BASE_URL'];
const baseURL = externalServer ?? `http://localhost:${PORT}`;
const webGpuProjects =
  process.env['CALIBRE_WEBGPU'] === '1'
    ? [
        {
          name: 'study-webgpu',
          use: {
            ...devices['Desktop Chrome'],
            headless: false,
            launchOptions: {
              args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'],
            },
          },
          testMatch: /\/study(-three|-parity)?\.spec\.ts$/,
        },
      ]
    : [];

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
          CALIBRE_MCP_SECRET: MCP_SECRET,
        },
      },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--enable-unsafe-swiftshader'] },
      },
      testIgnore: [
        /\.phone\.spec\.ts$/,
        /\.no-webgl\.spec\.ts$/,
        /\/study-parity\.spec\.ts$/,
      ],
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
    {
      name: 'no-webgl',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--disable-webgl', '--disable-webgl2'] },
      },
      testMatch: /\.no-webgl\.spec\.ts$/,
    },
    ...webGpuProjects,
  ],
});
