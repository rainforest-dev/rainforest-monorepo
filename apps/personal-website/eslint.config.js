import eslintPluginAstro from 'eslint-plugin-astro';

import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  ...eslintPluginAstro.configs.recommended,
  {
    ignores: ['**/.vercel', '**/.astro'],
  },
  {
    files: ['src/**/*.{ts,tsx,js,jsx,mjs}'],
    rules: {
      // Flat config replaces a rule's options instead of merging them, so the root pattern is repeated.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@rainforest-dev/search/node',
              message:
                'The public site never reaches a private host. Generate Ollama artifacts in scripts/ and commit them.',
            },
          ],
          patterns: [
            {
              group: ['../*'],
              message:
                'Import across directories through the @/ alias and the directory barrel (CLAUDE.md, Imports).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.astro'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@rainforest-dev/search/node',
              message:
                'The public site never reaches a private host. Generate Ollama artifacts in scripts/ and commit them.',
            },
          ],
        },
      ],
    },
  },
];
