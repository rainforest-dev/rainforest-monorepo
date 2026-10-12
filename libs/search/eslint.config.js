import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/node.ts', 'src/node/**', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message:
                'The root entry runs in browsers; node: imports belong in src/node.',
            },
          ],
        },
      ],
    },
  },
];
