// @ts-check
import node from '@astrojs/node';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Server-rendered dashboard: reads the AI-usage ledger from the vault via
// node:fs (see src/lib/ledger.ts) and serves aggregates through API routes
// that Vue islands fetch. Mirrors apps/rss-manager's data-side setup.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://usage.rainforest.tools',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  vite: { plugins: [tailwindcss()] },
  integrations: [vue()],
});
