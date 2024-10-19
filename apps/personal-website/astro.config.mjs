import { defineConfig } from 'astro/config';
import lit from '@astrojs/lit';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import mdx from '@astrojs/mdx';
// import tailwind from '@astrojs/tailwind';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  outDir: '../../dist/apps/personal-website',
  integrations: [
    lit(),
    react(),
    vue({
      appEntrypoint: '/src/pages/_app',
    }),
    mdx(),
    // tailwind({
    //   configFile: 'apps/personal-website/tailwind.config.mjs',
    // }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
