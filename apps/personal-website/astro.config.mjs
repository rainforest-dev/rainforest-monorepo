import { defineConfig } from 'astro/config';
import lit from "@astrojs/lit";
import react from "@astrojs/react";
import svelte from "@astrojs/svelte";
import vue from "@astrojs/vue";

import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import prefetch from "@astrojs/prefetch";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  integrations: [lit(), react(), svelte(), vue(), mdx(), partytown(), prefetch(), sitemap(), tailwind()]
});