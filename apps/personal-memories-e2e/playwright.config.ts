import { workspaceRoot } from '@nx/devkit';
import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const port = 3024;
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
      // Astro 7.3 backgrounds `astro dev` when it detects an agent; --ignore-lock keeps it in the foreground.
      `pnpm --dir apps/personal-memories exec astro dev --host 127.0.0.1 --port ${port} --ignore-lock`,
    url: baseURL,
    reuseExistingServer: false,
    cwd: workspaceRoot,
    env: {
      MEMORIES_DATA_DIR: dataDir,
      MEMORIES_NOTES_DIR: notesDir,
      MEMORIES_OWNER: 'Bob',
      MEMORIES_E2E: '1',
      MEMORIES_AUTHORS: 'alice@example.com=Alice,bob@example.com=Bob',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
