// @ts-check
import node from '@astrojs/node';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Loop Observatory: server-rendered dashboard for the whole autonomous loop
// (usage, budget, machines, loop status, sprint tasks). Reads the vault via
// node:fs (see src/lib/*.ts) and serves data through API routes that Vue
// islands fetch. Multi-page: `/` Overview and `/tasks` share a base layout.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://loop.rainforest.tools',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  vite: { plugins: [tailwindcss()] },
  integrations: [vue()],
});
