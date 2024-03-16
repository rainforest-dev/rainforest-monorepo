import { defineConfig } from 'astro/config';
import lit from '@astrojs/lit';
import react from '@astrojs/react';
import svelte from '@astrojs/svelte';
import vue from '@astrojs/vue';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import prefetch from '@astrojs/prefetch';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { fileURLToPath } from 'node:url';

// https://astro.build/config
export default defineConfig({
  vite: {
    // https://docs.astro.build/en/guides/troubleshooting/#adding-dependencies-to-astro-in-a-monorepo
    ssr: {
      noExternal: [
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
