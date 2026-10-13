import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { ExpansionFile } from '../src/utils/search-expansions.ts';
import type { NeighbourFile } from '../src/utils/search-neighbours.ts';
import { EXPANSIONS_PATH, loadPaletteRecords } from './palette-sources.ts';
import {
  NEIGHBOUR_FLOOR,
  NEIGHBOURS_PATH,
  neighbourStaleness,
} from './search-neighbours-build.ts';

const REGENERATE = 'pnpm nx run personal-website:build-search-neighbours';

describe('search-neighbours.json', () => {
  it('matches every palette record and the vocabulary', async () => {
    const records = await loadPaletteRecords();
    const expansions = (
      JSON.parse(readFileSync(EXPANSIONS_PATH, 'utf8')) as ExpansionFile
    ).records;
    const file = JSON.parse(
      readFileSync(NEIGHBOURS_PATH, 'utf8'),
    ) as NeighbourFile;
    const { stale, vocabulary } = neighbourStaleness(file, records, expansions);

    expect(records.length).toBeGreaterThan(0);
    expect(
      { stale, vocabulary },
      [
        'search-neighbours.json is out of date.',
        `Changed records: ${stale.join(', ') || '(none)'}`,
        `Vocabulary changed: ${vocabulary ? 'yes' : 'no'}`,
        `Regenerate with: ${REGENERATE}`,
      ].join('\n'),
    ).toEqual({ stale: [], vocabulary: false });
    expect(file.floor, `Regenerate with: ${REGENERATE}`).toBe(NEIGHBOUR_FLOOR);
  });
});
