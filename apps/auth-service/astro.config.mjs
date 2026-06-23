// @ts-check
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.WEBAUTHN_ORIGIN ?? 'https://auth.rainforest.tools',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  vite: { plugins: [tailwindcss()] },
  integrations: [react()],
});
