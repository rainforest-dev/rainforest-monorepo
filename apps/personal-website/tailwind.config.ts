import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import { utils } from '../../libs/design-system/src/lib/plugins';

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
