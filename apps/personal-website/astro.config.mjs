// @ts-check
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';

import { fallbackLng, supportedLngs } from './src/utils/i18n/settings';

// https://astro.build/config
export default defineConfig({
  site: 'https://rainforest.tools',
  env: {
    schema: {
      STRAPI_URL: envField.string({
        context: 'server',
        access: 'public',
        default: 'http://localhost:1337',
      }),
      STRAPI_TOKEN: envField.string({ context: 'server', access: 'secret' }),
    },
  },
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
          isCustomElement: (tag) =>
            tag.startsWith('md-') || ['iconify-icon'].includes(tag),
        },
      },
    }),
    sitemap(),
    (await import('astro-compress')).default(),
  ],
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    imageService: true,
  }),
});
