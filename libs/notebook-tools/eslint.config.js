import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    // Inside a lib, relative imports stay: tsconfig paths are not rewritten in the emitted .d.ts.
    rules: { 'no-restricted-imports': 'off' },
  },
];
