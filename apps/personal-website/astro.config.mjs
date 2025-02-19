// @ts-check
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import pwa from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';

import { fallbackLng, supportedLngs } from './src/utils/i18n/settings';

// https://astro.build/config
export default defineConfig({
  site: 'https://rainforest.tools',
  i18n: {
    defaultLocale: fallbackLng,
    locales: [...supportedLngs],
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'material-theme-lighter',
        dark: 'material-theme',
      },
    },
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
            tag.startsWith('md-') ||
            tag.startsWith('rf-') ||
            ['iconify-icon'].includes(tag),
        },
      },
    }),
    sitemap(),
    (await import('astro-compress')).default(),
    mdx(),
    pwa({
      mode: 'development',
      base: '/',
      scope: '/',
      includeAssets: ['favicon.svg'],
      registerType: 'autoUpdate',
      manifest: {
        name: "Rainforest's Personal Website",
        short_name: 'Rainforest Tools',
        theme_color: '#66b2b2',
      },
      workbox: {
        navigateFallback: '/',
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}'],
      },
      devOptions: {
        enabled: true,
        navigateFallbackAllowlist: [/^\//],
      },
      experimental: {
        directoryAndTrailingSlashHandler: true,
      },
    }),
  ],
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    imageService: true,
  }),
});
