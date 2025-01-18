/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      typography: () => ({
        DEFAULT: {
          css: {
            '--tw-prose-headings': 'var(--md-sys-color-primary)',
            '--tw-prose-body': 'var(--md-sys-color-on-surface)',
            '--tw-prose-links': 'var(--md-sys-color-tertiary)',
            '--tw-prose-hr': 'var(--md-sys-color-outline-variant)',
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
