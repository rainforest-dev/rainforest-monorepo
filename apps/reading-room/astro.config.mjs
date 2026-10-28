// @ts-check
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://library.rainforest.tools',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // Astro believes the Host header only for these; any other request is taken to be on
  // localhost. The pages read the hostname to link the other collections on the library and
  // to send the old hostname into it.
  security: {
    allowedDomains: [
      { hostname: 'library.rainforest.tools' },
      { hostname: 'rss.rainforest.tools' },
    ],
  },
  // The app shares its hostname with four others and owns only /rack and /kb, so its
  // bundles live under /rack too; the default /_astro would land on another app.
  build: { assets: 'rack/_astro' },
  vite: { plugins: [tailwindcss()] },
  integrations: [react()],
});
