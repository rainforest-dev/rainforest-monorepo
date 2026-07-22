// @ts-check
import { cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import pwa from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

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
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    {
      // The portfolio screenshots are owned by @rainforest-dev/personal-data (a
      // dist-built lib whose static assets aren't otherwise served). Copy them
      // into public/images/portfolio (a git-ignored build artifact) before dev
      // and build so Astro serves them at /images/portfolio/<slug>/… — the URLs
      // getProjectGallery() returns.
      name: 'copy-portfolio-screenshots',
      hooks: {
        'astro:config:setup'() {
          cpSync(
            fileURLToPath(
              new URL(
                '../../libs/personal-data/src/assets/portfolio',
                import.meta.url,
              ),
            ),
            fileURLToPath(new URL('./public/images/portfolio', import.meta.url)),
            { recursive: true },
          );
        },
      },
    },
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
