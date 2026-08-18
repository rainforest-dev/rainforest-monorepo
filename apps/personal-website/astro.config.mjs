// @ts-check
import { cpSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { cacheVercel } from '@astrojs/vercel/cache';
import vue from '@astrojs/vue';
import sentry from '@sentry/astro';
import tailwindcss from '@tailwindcss/vite';
import pwa from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

import { fallbackLng, supportedLngs } from './src/utils/i18n/settings';

// Legacy English case-study URLs. Derived from the project files rather than listed by hand
// so a newly added case study can't silently ship without its redirect — the hand-maintained
// list is exactly how /en/portfolio/<slug> got missed when /en/portfolio itself was covered.
const legacyPortfolioRedirects = Object.fromEntries(
  readdirSync(
    fileURLToPath(
      new URL('../../libs/personal-data/src/data/projects/en', import.meta.url),
    ),
  )
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
    .map((slug) => [`/en/portfolio/${slug}`, `/portfolio/${slug}`]),
);

// Wire Sentry only when the (public) DSN is configured — i.e. production and
// preview on Vercel. Local/dev builds have no DSN, so the integration is
// omitted entirely and nothing Sentry-related ships. SDK init + options live in
// sentry.{client,server}.config.js; source-map upload is disabled so no
// SENTRY_AUTH_TOKEN (and no @sentry/cli binary) is required.
const sentryEnabled = !!process.env.PUBLIC_SENTRY_DSN;

// https://astro.build/config
export default defineConfig({
  site: 'https://rainforest.tools',
  i18n: {
    defaultLocale: fallbackLng,
    locales: [...supportedLngs],
  },
  // Back-compat: English used to live under /en/…; it's now canonical at the root.
  // Redirect the previously-shipped English pages to their bare paths. Exact paths
  // only — Astro's Vercel adapter doesn't substitute a rest param into a redirect
  // target, so a `/en/[...slug]` catch-all would emit a literal, broken Location.
  redirects: {
    '/en': '/',
    '/en/portfolio': '/portfolio',
    '/en/resume': '/resume',
    ...legacyPortfolioRedirects,
  },
  markdown: {
    shikiConfig: {
      themes: {
        light: 'material-theme-lighter',
        dark: 'material-theme',
      },
    },
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  vite: {
    plugins: [
      tailwindcss(),
      // @vitejs/plugin-react runs React Fast Refresh inside Vite's oxc transform and enables
      // it from a `pre` config hook (`oxc.jsx.refresh = command === 'serve'`). oxc decides per
      // module from the resolved lang, and Vite serves a Vue SFC's `<script setup lang="ts">`
      // as `Foo.vue?vue&type=script&setup=true&lang.ts` — so the refresh helpers were injected
      // into Vue components and `astro dev` died on every page with
      // `$RefreshSig$ is not defined`. Dev-only: production strips Fast Refresh, which is why
      // `astro build` passed the whole time dev was unusable.
      //
      // Neither react({ exclude }) nor oxc.jsxRefreshExclude reaches this — the plugin's own
      // `pre` hook re-supplies those filters — and narrowing react({ include }) breaks the
      // build, since `include` also drives Astro's renderer detection for the .tsx case
      // studies in libs/personal-portfolio. A `post` plugin is what actually wins the merge.
      //
      // Cost: the React case studies fall back to a full reload instead of state-preserving
      // refresh. Vue/Astro HMR is untouched.
      {
        name: 'rainforest:disable-react-fast-refresh',
        enforce: 'post',
        config: () => ({ oxc: { jsx: { refresh: false } } }),
      },
    ],
    resolve: {
      // `layouts/blog.astro` and `layouts/quick-post.astro` import `katex/dist/katex.min.css`.
      // Under SSR, Astro externalises bare-specifier imports and hands them to Node, which has no
      // loader for `.css` and dies with `ERR_UNKNOWN_FILE_EXTENSION` on every page. Keeping katex
      // internal lets Vite process the stylesheet, which is what it does in the client build.
      //
      // Dev-only in effect, and that is the trap: `astro build` succeeded and shipped a correct
      // fingerprinted stylesheet the whole time `astro dev` was unusable — the same asymmetry the
      // React Fast Refresh plugin above exists to work around.
      noExternal: ['katex'],
    },
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
            fileURLToPath(
              new URL('./public/images/portfolio', import.meta.url),
            ),
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
    // `CSS: false` — astro-compress minifies with csso, which cannot parse Media Queries
    // Level 4 range syntax and drops those at-rules outright. Tailwind v4 emits every
    // breakpoint that way (`@media (width >= 80rem)`), so the built stylesheet lost all six
    // responsive breakpoints while non-width queries (prefers-color-scheme, hover, print)
    // survived: `hidden xl:flex` collapsed to `hidden` and `flex xl:hidden` to `flex`, so the
    // desktop hero never rendered and the skills grid stayed one column at any width. Dev was
    // unaffected — the same build/dev asymmetry as the two Vite workarounds above, in the
    // opposite direction. Vite already minifies CSS, so this pass only cost us 16KB of rules.
    (await import('astro-compress')).default({ CSS: false }),
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
    ...(sentryEnabled
      ? [
          sentry({
            sourceMapsUploadOptions: { enabled: false },
            // Error monitoring only — tree-shake the tracing and replay code we
            // never initialise (see sentry.{client,server}.config.js) out of the
            // client bundle.
            bundleSizeOptimizations: {
              excludeTracing: true,
              excludeReplay: true,
            },
          }),
        ]
      : []),
  ],
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    imageService: true,
  }),
  // Astro 7 route caching (@astrojs/vercel 11): on-demand responses that opt in
  // via `context.cache.set()` / `Astro.cache.set()` are pushed to Vercel's edge
  // and served straight from the CDN on a hit, without invoking the function.
  // Most pages are prerendered (already CDN-static) so this only matters for the
  // few genuinely on-demand routes — see src/pages/[lang]/rss.xml.ts.
  cache: {
    provider: cacheVercel(),
  },
});
