// @ts-check
import node from '@astrojs/node';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Loop Observatory: server-rendered dashboard for the whole autonomous loop
// (usage, budget, machines, loop status, sprint tasks). Reads the vault via
// node:fs (see src/lib/*.ts) and serves data through API routes that Vue
// islands fetch. Multi-page: `/` Overview and `/tasks` share a base layout.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://loop.rainforest.tools',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // Astro's own origin check compares the Origin header against the request as
  // the server received it, which is http:// behind this deployment's TLS
  // terminator -- so every POST from the public https:// address was rejected.
  // `src/middleware.ts` checks an allowlist instead; see src/lib/originGuard.ts.
  security: { checkOrigin: false },
  vite: { plugins: [tailwindcss()] },
  integrations: [vue()],
});
