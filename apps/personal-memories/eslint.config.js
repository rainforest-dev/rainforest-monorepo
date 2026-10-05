import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    // Run by plain `node`, which cannot resolve the @/ alias.
    files: ['src/cli/**', 'src/lib/ingest/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
];
