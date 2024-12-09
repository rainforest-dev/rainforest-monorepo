import eslintPluginAstro from 'eslint-plugin-astro';

import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  ...eslintPluginAstro.configs.recommended,
  {
    ignores: ['**/.vercel', '**/.astro'],
  },
];
