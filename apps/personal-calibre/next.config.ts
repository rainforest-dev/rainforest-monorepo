import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';

const nextConfig: WithNxOptions = {
  nx: {
    svgr: false,
  },
  cacheComponents: true,
  images: { unoptimized: true },
  logging: { browserToTerminal: 'error' },
};

export default composePlugins(withNx)(nextConfig);
