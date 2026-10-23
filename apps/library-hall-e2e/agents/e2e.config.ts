import { github } from '@e2e-dev/github';
import { web } from '@e2e-dev/web';
import type { E2EConfig } from 'e2e';

import { agents } from './support/agents.ts';

/**
 * Agent-driven e2e for the library hall (TesterArmy's open-source `e2e` runner), against its
 * production build and a fictional set of collections. The model reads the page the way a reader
 * would, so these catch what locator tests miss: a hall that shows one collection, a camera that
 * will not turn, a shell that differs between apps. `e2e.live.config.ts` runs against the
 * deployed library.
 */
const config: E2EConfig = {
  targets: [
    {
      name: 'hall',
      engine: web({ viewport: { width: 1280, height: 800 } }),
      app: {
        url: 'http://127.0.0.1:0',
        command: {
          executable: 'node',
          args: ['support/serve-hall.mjs', '{port}'],
          startupTimeout: 120_000,
          log: '.e2e/logs/hall.log',
        },
      },
    },
  ],
  tests: ['tests/**/*.e2e.ts'],
  agents,
  // CI keeps the cache in an Actions cache, so it records too and later runs replay.
  cache: { mode: 'read-write' },
  reporters: process.env['GITHUB_ACTIONS']
    ? ['list', 'junit', github()]
    : ['list'],
};

export default config;
