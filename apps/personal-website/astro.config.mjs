import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';
import vue from '@astrojs/vue';
import { supportedLocales } from '@rainforest-dev/personal-data';
import commonEn from '@rainforest-dev/personal-data/locales/en/common.json' with { type: 'json' };
import commonZh from '@rainforest-dev/personal-data/locales/zh/common.json' with { type: 'json' };
import tailwindcss from '@tailwindcss/vite';
import pwa from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';
import { mapValues } from 'lodash-es';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

const locales = {
  en: commonEn,
  zh: commonZh,
};

// https://astro.build/config
export default defineConfig({
  site: 'https://rainforest.tools',
  markdown: {
    shikiConfig: {
      themes: {
        light: 'material-theme-lighter',
        dark: 'material-theme',
      },
    },
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },

  integrations: [
    starlight({
      title: mapValues(locales, (locale) => locale['title']),
      locales: Object.fromEntries(
        supportedLocales.map((locale) => [
          locale === 'en' ? 'root' : locale,
          { label: commonEn[locale], lang: locale },
        ]),
      ),
      social: {
        github: 'https://github.com/rainforest-dev',
      },
      sidebar: [
        {
          label: 'Guides',
          items: [
            // Each item here is one entry in the navigation menu.
            { label: 'Example Guide', slug: 'guides/example' },
          ],
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
      ],
    }),
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
        name: commonEn['title'],
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

  vite: {
    plugins: [tailwindcss()],
  },
});
