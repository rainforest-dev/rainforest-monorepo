import { join } from 'node:path';

import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';

// The collection's mount on the library hostname, `getCollection('books').basePath`, and that
// hostname. Spelled out because Nx reads this file before the contract is built;
// `base-path.test.ts` keeps them equal to the contract.
const BASE_PATH = '/books';
const LIBRARY_ORIGIN = 'https://library.rainforest.tools';
// The app's own hostname before the library. Its pages move to the library; its feeds and APIs
// stay answering here, under the base path.
const OLD_HOST = 'calibre\\.rainforest\\.tools';
const onOldHost = [{ type: 'host' as const, value: OLD_HOST }];

const nextConfig: WithNxOptions = {
  // Pages, API routes and public files all sit under it, so links and fetches inside the app go
  // through `withBase`. Next answers nothing outside it, not even through a rewrite or the
  // proxy, so the paths callers used before the move are redirects below.
  basePath: '/books',
  cacheComponents: true,
  images: { unoptimized: true },
  logging: { browserToTerminal: 'error' },
  output: 'standalone',
  // Next guesses the root from the outermost lockfile, which is wrong in a nested git worktree.
  outputFileTracingRoot: join(__dirname, '..', '..'),
  async redirects() {
    return [
      // Old links into the app on its own hostname land on the same page in the library.
      {
        source: '/notebooks/:path*',
        has: onOldHost,
        destination: `${LIBRARY_ORIGIN}/notebooks/:path*`,
        basePath: false,
        permanent: true,
      },
      {
        source: '/',
        has: onOldHost,
        destination: `${LIBRARY_ORIGIN}${BASE_PATH}`,
        basePath: false,
        permanent: true,
      },
      {
        source:
          '/:path((?!(?:books|api|mcp|opds|files|_shell|_next)(?:/|$)).+)',
        has: onOldHost,
        destination: `${LIBRARY_ORIGIN}${BASE_PATH}/:path`,
        basePath: false,
        permanent: true,
      },
      // A book's full page was `/books/<id>` before the base path.
      {
        source: '/books/:id(\\d+)',
        destination: `${BASE_PATH}/books/:id`,
        basePath: false,
        permanent: true,
      },
      // Feeds, APIs and MCP on any hostname, for OPDS readers, scripts and the gateway that
      // still call the old paths. 308 keeps the method and body.
      ...['/mcp', '/opds', '/opds/:path*', '/api/:path*', '/files/:path*'].map(
        (source) => ({
          source,
          destination: `${BASE_PATH}${source}`,
          basePath: false as const,
          permanent: true,
        }),
      ),
      // Shell assets belong to the hall on the library hostname; elsewhere (dev, e2e, the old
      // hostname) the app's own copy answers.
      {
        source: '/_shell/:path*',
        destination: `${BASE_PATH}/_shell/:path*`,
        basePath: false,
        permanent: false,
      },
      {
        source: '/',
        destination: BASE_PATH,
        basePath: false,
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-transform' }],
      },
      {
        // Shared with every library app at the same URL; a week, revalidated in the background.
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
