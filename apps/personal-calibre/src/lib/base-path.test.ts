import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { LIBRARY_ORIGIN } from '@rainforest-dev/library-contract';
import { describe, expect, it } from 'vitest';

import { BASE_PATH, withBase } from './base-path';

describe('base path', () => {
  it('matches the basePath next.config spells out', () => {
    const config = readFileSync(
      join(import.meta.dirname, '../../next.config.ts'),
      'utf8',
    );
    expect(config).toContain(`basePath: '${BASE_PATH}',`);
    expect(config).toContain(`const BASE_PATH = '${BASE_PATH}';`);
    expect(config).toContain(`const LIBRARY_ORIGIN = '${LIBRARY_ORIGIN}';`);
  });

  it('prefixes paths inside the app', () => {
    expect(withBase('/api/books/1/cover')).toBe('/books/api/books/1/cover');
  });
});
