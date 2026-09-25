import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, 'global.css'), 'utf8');

const block = (condition: string) => {
  const start = css.indexOf(`@supports ${condition} {`);
  if (start === -1) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  return '';
};

describe('heat cell preview CSS', () => {
  it('anchors the preview where position-area is supported', () => {
    const anchored = block('(position-area: top)');
    expect(anchored).toMatch(/\[data-preview\]/);
    expect(anchored).toMatch(/position:\s*fixed/);
    expect(anchored).toMatch(/position-area:\s*top;/);
    expect(anchored).toMatch(/position-try-fallbacks:[^;]*--below/);
    expect(anchored).toMatch(
      /@position-try --below \{\s*position-area:\s*bottom;/,
    );
  });

  it('falls back to an absolute position above the cell everywhere else', () => {
    const fallback = block('not (position-area: top)');
    expect(fallback).toMatch(/\[data-preview\]/);
    expect(fallback).toMatch(/position:\s*absolute/);
    expect(fallback).toMatch(/bottom:\s*calc\(100% \+ 0\.5rem\)/);
    expect(fallback).toMatch(/left:\s*50%/);
    expect(fallback).toMatch(/translate:\s*-50% 0/);
  });
});
