import { defineConfig } from 'astro/config';
import lit from '@astrojs/lit';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import partytown from '@astrojs/partytown';
import tailwind from '@astrojs/tailwind';
import { fileURLToPath } from 'node:url';

// https://astro.build/config
export default defineConfig({
  outDir: '../../dist/apps/personal-website',
  integrations: [
    lit(),
    react(),
    vue(),
    partytown(),
    tailwind({
      configFile: fileURLToPath(
        new URL('./tailwind.config.cjs', import.meta.url)
      ),
    }),
  ],
});
