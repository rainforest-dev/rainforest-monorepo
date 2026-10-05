import { join } from 'node:path';

import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';

const nextConfig: WithNxOptions = {
  cacheComponents: true,
  images: { unoptimized: true },
  logging: { browserToTerminal: 'error' },
  output: 'standalone',
  // Next guesses the root from the outermost lockfile, which is wrong in a nested git worktree.
  outputFileTracingRoot: join(__dirname, '..', '..'),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Cache-Control', value: 'no-transform' }],
      },
    ];
  },
};

export default composePlugins(withNx)(nextConfig);
