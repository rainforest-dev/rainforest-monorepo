import eslintPluginAstro from 'eslint-plugin-astro';

import baseConfig from '../../eslint.config.js';

/** @type {import('eslint').Linter.Config} */
const config = [
  ...baseConfig,
  ...eslintPluginAstro.configs.recommended,
  {
    ignores: ['**/.vercel', '**/.astro'],
  },
];

export default config;
