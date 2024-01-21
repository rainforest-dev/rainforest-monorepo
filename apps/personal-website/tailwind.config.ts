import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import { utils } from '../../libs/design-system/src/lib/plugins';
import { md3ToTailwind } from './md3';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ...md3ToTailwind,
      },
      fontFamily: Object.fromEntries(
        Object.entries(defaultTheme.fontFamily).map(([key, value]) => {
          const fontFamilies = [key, [value, 'Material Symbols Outlined']];
          if (key === 'serif') fontFamilies.push('Lora');
          return fontFamilies;
        })
      ),
    },
  },
  plugins: [utils],
} satisfies Config;
