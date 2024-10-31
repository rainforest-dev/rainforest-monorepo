// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import lit from '@astrojs/lit';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    lit(),
    react(),
    vue(),
    icon({
      include: {
        logos: ['vue', 'react', 'flutter', 'docker-icon', 'nextjs-icon'],
      },
    }),
  ],
});
