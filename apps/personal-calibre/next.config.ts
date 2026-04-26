import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';

const nextConfig: WithNxOptions = {
  cacheComponents: true,
  images: { unoptimized: true },
  logging: { browserToTerminal: 'error' },
  output: 'standalone',
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
