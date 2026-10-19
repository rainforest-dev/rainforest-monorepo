// @ts-check
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://library.rainforest.tools',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // The app shares its hostname with four others and owns only /rack and /kb, so its
  // bundles live under /rack too; the default /_astro would land on another app.
  build: { assets: 'rack/_astro' },
  vite: { plugins: [tailwindcss()] },
  integrations: [react()],
});
