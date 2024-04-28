import { defineConfig } from 'astro/config';
import lit from '@astrojs/lit';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import svelte from '@astrojs/svelte';
import partytown from '@astrojs/partytown';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  outDir: '../../dist/apps/personal-website',
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [lit(), vue(), react(),  svelte(), partytown(), sitemap()],
});
