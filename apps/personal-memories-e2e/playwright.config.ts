import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const portForCheckout = (root: string) =>
  40_000 +
  ([...root].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 0) %
    10_000);

const port =
  Number(process.env['MEMORIES_E2E_PORT']) || portForCheckout(workspaceRoot);
const baseURL = `http://127.0.0.1:${port}`;
// Synthetic data built from the parser fixtures; real data is never read.
const dataDir = path.join(__dirname, 'test-output', 'fixture-data');
const notesDir = path.join(__dirname, 'test-output', 'notes');

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      `node apps/personal-memories/src/cli/fixture.ts "${dataDir}" && ` +
      `rm -rf "${notesDir}" && mkdir -p "${notesDir}" && ` +
      'node apps/personal-memories/dist/server/entry.mjs',
    url: baseURL,
    reuseExistingServer: false,
    cwd: workspaceRoot,
    env: {
      HOST: '127.0.0.1',
      PORT: String(port),
      MEMORIES_DATA_DIR: dataDir,
      MEMORIES_NOTES_DIR: notesDir,
      MEMORIES_OWNER: 'Bob',
      MEMORIES_EMBED: 'fake',
      MEMORIES_AUTHORS: 'alice@example.com=Alice,bob@example.com=Bob',
      MEMORIES_MCP_SECRET: 'test-secret',
      MEMORIES_PUBLIC_URL: 'https://memories.example.test',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: 'reload.spec.ts',
    },
    {
      name: 'rewrites-fixture-data',
      use: { ...devices['Desktop Chrome'] },
      testMatch: 'reload.spec.ts',
      dependencies: ['chromium'],
    },
  ],
});
