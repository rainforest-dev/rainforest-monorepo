// @ts-check
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import { fallbackLng, supportedLngs } from './src/utils/i18n/settings';

// https://astro.build/config
export default defineConfig({
  i18n: {
    defaultLocale: fallbackLng,
    locales: [...supportedLngs],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    react(),
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('md-'),
        },
      },
    }),
  ],
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    imageService: true,
    isr: true,
  }),
});
