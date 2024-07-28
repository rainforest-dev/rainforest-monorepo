const { join } = require('path');
const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    join(__dirname, 'src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'),
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: [
          'Lora',
          '"Material Symbols Outlined"',
          ...defaultTheme.fontFamily.serif,
        ],
        sans: ['"Material Symbols Outlined"', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
  ],
};
