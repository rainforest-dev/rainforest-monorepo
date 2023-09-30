import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import { utils } from '../../dist/libs/design-system/plugins';
// import { utils } from '@rainforest-tools/design-system/plugins';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: Object.fromEntries(
        Object.entries(defaultTheme.fontFamily).map(([key, value]) => [
          key,
          [value, 'Material Symbols Outlined'],
        ])
      ),
    },
  },
  plugins: [utils],
} satisfies Config;
