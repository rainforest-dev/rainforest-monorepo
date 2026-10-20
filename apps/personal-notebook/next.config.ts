import { join } from 'node:path';

import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';

const nextConfig: WithNxOptions = {
  // The collection's mount on the library hostname, `getCollection('notebooks').basePath`.
  // Spelled out because Nx reads this file before the contract is built; `base-path.test.ts`
  // keeps the two equal. Pages, API routes and public files all sit under it, so links and
  // fetches inside the app go through `withBase`.
  basePath: '/notebooks',
  cacheComponents: true,
  images: { unoptimized: true },
  logging: { browserToTerminal: 'error' },
  output: 'standalone',
  // Next guesses the root from the outermost lockfile, which is wrong in a nested git worktree.
  outputFileTracingRoot: join(__dirname, '..', '..'),
  async redirects() {
    return [
      // Shell assets belong to the hall on the library hostname, so every app shares one cached
      // copy; elsewhere (dev, e2e) the app's own copy under the base path answers. Browsers ask
      // for `/favicon.ico` on their own.
      ...['/_shell/:path*', '/favicon.ico'].map((source) => ({
        source,
        destination: `/notebooks${source}`,
        basePath: false as const,
        permanent: false,
      })),
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-transform' }],
      },
      {
        // The same files every library app serves; a week, revalidated in the background.
        source: '/_shell/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value:
              'public, max-age=604800, stale-while-revalidate=86400, no-transform',
          },
        ],
      },
    ];
  },
};

export default composePlugins(withNx)(nextConfig);
