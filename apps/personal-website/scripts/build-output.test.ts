import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { scanOutput } from './output-scan.ts';

const OUTPUTS = ['dist', '.vercel/output'].map((dir) =>
  resolve(import.meta.dirname, '..', dir),
);

describe('build output', () => {
  it.each(OUTPUTS)('%s names no private host', (dir) => {
    expect(existsSync(dir), `${dir} is missing; build first`).toBe(true);
    expect(scanOutput(dir)).toEqual([]);
  });
});
