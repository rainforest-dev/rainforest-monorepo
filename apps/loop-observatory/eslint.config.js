import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    // Astro regenerates `.astro/` (content.d.ts, types.d.ts) on every build.
    // It's generated output rather than source, and it trips rules the base
    // config enforces (`no-empty-object-type`, `triple-slash-reference`), so
    // it must not be linted — same exclusion personal-website uses.
    ignores: ['**/.astro', '**/dist'],
  },
];
