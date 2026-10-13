import { readFileSync, statSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { type Searchable, searchRecords } from '../src/utils/search.ts';
import type { ExpansionFile } from '../src/utils/search-expansions.ts';
import { EXPANSIONS_PATH, loadPaletteRecords } from './palette-sources.ts';
import {
  NEIGHBOURS_PATH,
  neighbourStaleness,
} from './search-neighbours-build.ts';

const expansions = (
  JSON.parse(readFileSync(EXPANSIONS_PATH, 'utf8')) as ExpansionFile
).records;

async function paletteRecords(lang: 'en' | 'zh'): Promise<Searchable[]> {
  return (await loadPaletteRecords())
    .filter((record) => record.id.split('/')[1] === lang)
    .map((record) => ({ ...record, expanded: expansions[record.id]?.terms }));
}

const mentions = (record: Searchable, word: string) =>
  [record.title, ...record.keywords, ...(record.expanded ?? [])].some((text) =>
    text.toLowerCase().includes(word),
  );

describe('committed search-neighbours.json', () => {
  it('finds a 資料庫 record that neither lists the word nor expands to it', async () => {
    const records = await paletteRecords('zh');
    const hits = searchRecords('資料庫', records);
    expect(hits.some((record) => !mentions(record, '資料庫'))).toBe(true);
  });

  it.each(['a', '資', 'r', 'ｒ'])(
    'leaves a one-character query (%s) to tieredMatch and expansions',
    async (query) => {
      const records = [
        ...(await paletteRecords('en')),
        ...(await paletteRecords('zh')),
      ];
      const terms = new Proxy(
        {},
        {
          ownKeys: () => {
            throw new Error('vocabulary looked up');
          },
        },
      );
      expect(searchRecords(query, records, { terms })).toEqual(
        searchRecords(query, records, { terms: {} }),
      );
      expect(searchRecords(query, records)).toEqual(
        searchRecords(query, records, { terms: {} }),
      );
    },
  );

  it('stays under 100 KB', () => {
    expect(statSync(NEIGHBOURS_PATH).size).toBeLessThan(100 * 1024);
  });

  it('marks a record stale when its keywords change', async () => {
    const records = await loadPaletteRecords();
    const file = JSON.parse(readFileSync(NEIGHBOURS_PATH, 'utf8'));
    const [first, ...rest] = records;
    const changed = [{ ...first, keywords: [...first.keywords, 'cobol'] }];
    const result = neighbourStaleness(file, [...changed, ...rest], expansions);
    expect(result.stale).toEqual([first.id]);
    expect(result.vocabulary).toBe(true);
  });
});
