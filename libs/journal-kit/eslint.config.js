import { builtinModules } from 'node:module';

import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/server.ts', 'src/server/**', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['process', 'Buffer', '__dirname', '__filename', 'require'].map(
          (name) => ({
            name,
            message:
              'The root entry runs in browsers; Node globals belong in src/server.',
          }),
        ),
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                ...builtinModules,
                ...builtinModules.map((name) => `${name}/*`),
              ],
              message:
                'The root entry runs in browsers; node: imports belong in src/server.',
            },
          ],
        },
      ],
    },
  },
];
