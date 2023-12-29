import { defineConfig } from 'astro/config';
import lit from '@astrojs/lit';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import vue from '@astrojs/vue';
// import node from '@astrojs/node';

import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import prefetch from '@astrojs/prefetch';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import path from 'path';

// https://astro.build/config
export default defineConfig({
  // output: 'server',
  // adapter: node({
  //   mode: 'standalone',
  // }),
  vite: {
    // https://docs.astro.build/en/guides/troubleshooting/#adding-dependencies-to-astro-in-a-monorepo
    ssr: {
      noExternal: [
        // '@astrojs/node',
        '@astrojs/lit',
        '@astrojs/react',
        '@astrojs/svelte',
        '@astrojs/vue',
        '@astrojs/mdx',
        '@astrojs/partytown',
        '@astrojs/prefetch',
        '@astrojs/sitemap',
        '@astrojs/tailwind',
      ],
    },
  },
  integrations: [
    lit(),
    react(),
    svelte(),
    vue(),
    mdx(),
    partytown(),
    prefetch(),
    sitemap(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
