import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  type ExpansionFile,
  planExpansion,
} from '../src/utils/search-expansions.ts';
import { EXPANSIONS_PATH, loadPaletteRecords } from './palette-sources.ts';

const REGENERATE =
  'OLLAMA_MODEL=<model> pnpm nx run personal-website:expand-search-keywords';

describe('search-expansions.json', () => {
  it('has a current entry for every palette record', async () => {
    const records = await loadPaletteRecords();
    const { records: existing } = JSON.parse(
      readFileSync(EXPANSIONS_PATH, 'utf8'),
    ) as ExpansionFile;
    const { pending } = planExpansion(records, existing);
    const missing = pending.filter((r) => !existing[r.id]).map((r) => r.id);
    const stale = pending.filter((r) => existing[r.id]).map((r) => r.id);

    expect(records.length).toBeGreaterThan(0);
    expect(
      pending,
      [
        'search-expansions.json is out of date.',
        `Missing: ${missing.join(', ') || '(none)'}`,
        `Stale: ${stale.join(', ') || '(none)'}`,
        `Regenerate with: ${REGENERATE}`,
      ].join('\n'),
    ).toEqual([]);
  });
});
