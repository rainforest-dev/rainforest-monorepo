import baseConfig from '../../eslint.config.js';
import eslintPluginAstro from 'eslint-plugin-astro';
import jsoncParser from 'jsonc-eslint-parser';

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
        },
      ],
    },
    languageOptions: {
      parser: jsoncParser,
    },
  },
];
