// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import { configs } from 'eslint-plugin-lit';
import storybook from "eslint-plugin-storybook";
import jsoncParser from 'jsonc-eslint-parser';

import baseConfig from '../../eslint.config.js';

export default [...baseConfig, configs['flat/recommended'], {
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
}, ...storybook.configs["flat/recommended"]];
