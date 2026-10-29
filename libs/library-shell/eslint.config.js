import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import jsoncParser from 'jsonc-eslint-parser';

import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    files: ['**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
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
            // The story gallery and its specs only run under Playwright, never in the package.
            '{projectRoot}/playwright.config.ts',
            '{projectRoot}/playwright/**',
          ],
          ignoredDependencies: ['react-dom'],
        },
      ],
    },
    languageOptions: {
      parser: jsoncParser,
    },
  },
  {
    // Inside a lib, relative imports stay: tsconfig paths are not rewritten in the emitted .d.ts.
    rules: { 'no-restricted-imports': 'off' },
  },
];
