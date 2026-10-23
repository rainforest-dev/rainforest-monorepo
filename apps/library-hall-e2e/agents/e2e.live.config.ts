import { web } from '@e2e-dev/web';
import type { E2EConfig } from 'e2e';

import { agents } from './support/agents.ts';

/**
 * The deployed library, read-only. Cloudflare Access guards it, so the run needs an Access
 * service token that the library's Access policy accepts. The web engine sends these headers to
 * the app's own site only (`siteHeadersFor` in `@e2e-dev/web`), never to other origins.
 */
const config: E2EConfig = {
  targets: [
    {
      name: 'live',
      engine: web({
        viewport: { width: 1280, height: 800 },
        headers: {
          'CF-Access-Client-Id': process.env['CF_ACCESS_CLIENT_ID'] ?? '',
          'CF-Access-Client-Secret':
            process.env['CF_ACCESS_CLIENT_SECRET'] ?? '',
        },
      }),
      app: {
        url: process.env['LIBRARY_URL'] ?? 'https://library.rainforest.tools',
        identity: 'library-live',
      },
    },
  ],
  tests: ['live/**/*.e2e.ts'],
  agents,
  // The live shelves change every day, so a recording would rarely replay.
  cache: { mode: 'off' },
  // The repository is public, and so are its Actions logs. In CI the run writes only a JUnit
  // file, which stays on the runner; the job prints its pass and fail counts and nothing a page
  // showed.
  reporters: process.env['GITHUB_ACTIONS'] ? ['junit'] : ['list'],
};

export default config;
