import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = import.meta.dirname;

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === '__fixtures__' ? [] : sources(path);
    return /\.(astro|tsx|ts|css)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [relative(SRC, path)]
      : [];
  });

const PALETTE =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/;

describe('tokens only', () => {
  it.each(sources(SRC))('%s uses semantic tokens only', (file) => {
    const src = readFileSync(join(SRC, file), 'utf8');
    expect(src).not.toMatch(/\bdark:/);
    expect(src).not.toMatch(PALETTE);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
