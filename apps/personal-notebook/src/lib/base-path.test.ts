import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BASE_PATH, withBase } from './base-path';

describe('base path', () => {
  it('matches the basePath next.config spells out', () => {
    const config = readFileSync(
      join(import.meta.dirname, '../../next.config.ts'),
      'utf8',
    );
    expect(config).toContain(`basePath: '${BASE_PATH}',`);
  });

  it('prefixes paths inside the app', () => {
    expect(withBase('/api/notebooks')).toBe('/notebooks/api/notebooks');
  });
});
