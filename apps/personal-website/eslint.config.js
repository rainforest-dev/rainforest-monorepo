import eslintPluginAstro from 'eslint-plugin-astro';

import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  ...eslintPluginAstro.configs.recommended,
  {
    ignores: ['**/.vercel', '**/.astro'],
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs}',
            '{projectRoot}/vite.config.{js,ts,mjs,mts}',
          ],
          ignoredDependencies: ['@rainforest-dev/rainforest-ui'],
        },
      ],
    },
    languageOptions: {
      parser: jsoncParser,
    },
  },
];
