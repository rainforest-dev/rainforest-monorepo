import jsoncParser from 'jsonc-eslint-parser';

import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    ignores: ['types/generated'],
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
          ignoredDependencies: [
            'react',
            'react-dom',
            'react-router-dom',
            'styled-components',
            'sharp',
          ],
        },
      ],
    },
    languageOptions: {
      parser: jsoncParser,
    },
  },
];
