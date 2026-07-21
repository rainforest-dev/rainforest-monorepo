// @vitest-environment node
//
// This suite only reads a CSS file and pattern-matches its text — no DOM
// needed. Forcing the `node` environment (instead of the project's default
// `jsdom`) avoids a Vite quirk: under jsdom, Vite's browser transform
// special-cases the `new URL('./relative', import.meta.url)` syntax below as
// an asset-URL reference and resolves it against the dev-server origin
// (`http://localhost:3000/...`) instead of leaving it as a real `file://`
// URL, which breaks `fileURLToPath`. The `node` (SSR) transform doesn't
// apply that rewrite, so the relative path resolves correctly on disk.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('./theme.css', import.meta.url)),
  'utf8',
);

describe('per-project theme tokens', () => {
  for (const slug of [
    'hoogii-wallet',
    'hashgreen-dex',
    'hashgreen-swap',
    'opencgt',
  ]) {
    it(`defines a scoped --primary for ${slug}`, () => {
      expect(css).toContain(`[data-project="${slug}"]`);
      expect(css).toMatch(
        new RegExp(`\\[data-project="${slug}"\\][^}]*--primary:`),
      );
    });
  }
});
