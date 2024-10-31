// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import lit from '@astrojs/lit';
import react from '@astrojs/react';
import vue from '@astrojs/vue';

import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [lit(), react(), vue()],
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    imageService: true,
    isr: true,
  }),
});
