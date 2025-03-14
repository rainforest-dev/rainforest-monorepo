import { configs } from 'eslint-plugin-lit';
import jsoncParser from 'jsonc-eslint-parser';

import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  configs['flat/recommended'],
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
          ignoredDependencies: ['tailwindcss'],
        },
      ],
    },
    languageOptions: {
      parser: jsoncParser,
    },
  },
];
