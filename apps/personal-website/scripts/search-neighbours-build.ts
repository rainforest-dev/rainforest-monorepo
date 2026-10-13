import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { fold, topK } from '@rainforest-dev/search';

import type { Searchable } from '../src/utils/search.ts';
import type { ExpansionFile } from '../src/utils/search-expansions.ts';
import { words } from '../src/utils/search-expansions.ts';
import type {
  Neighbour,
  NeighbourFile,
} from '../src/utils/search-neighbours.ts';

export const NEIGHBOURS_PATH = resolve(
  import.meta.dirname,
  '../src/data/search-neighbours.json',
);
export const VECTOR_CACHE_DIR = resolve(
  import.meta.dirname,
  '../.cache/search-vectors',
);
export const NEIGHBOURS_PER_LANGUAGE = 8;
export const NEIGHBOUR_FLOOR = 0.707;

export const hashText = (text: string) =>
  createHash('sha256').update(text).digest('hex').slice(0, 16);

export function documentText(
  record: Pick<Searchable, 'title' | 'keywords'>,
  expansions: ExpansionFile['records'],
  id: string,
): string {
  return [record.title, ...record.keywords, ...(expansions[id]?.terms ?? [])]
    .filter(Boolean)
    .join('. ');
}

export function recordHashes(
  records: Searchable[],
  expansions: ExpansionFile['records'],
): Record<string, string> {
  return Object.fromEntries(
    records.map((r) => [r.id, hashText(documentText(r, expansions, r.id))]),
  );
}

export function buildVocabulary(
  records: Searchable[],
  expansions: ExpansionFile['records'],
): string[] {
  const terms = new Set<string>();
  for (const record of records) {
    for (const word of words(fold(record.title))) terms.add(word);
    for (const keyword of record.keywords) terms.add(fold(keyword).trim());
    for (const term of expansions[record.id]?.terms ?? [])
      terms.add(fold(term).trim());
  }
  return [...terms].filter((t) => [...t].length >= 2).sort();
}

export const hashVocabulary = (vocabulary: string[]) =>
  hashText(JSON.stringify(vocabulary));

const LANGUAGES = new Set(['en', 'zh']);
const languageOf = (id: string) => {
  const segment = id.split('/')[1];
  return LANGUAGES.has(segment) ? segment : undefined;
};

export function selectNeighbours({
  recordIds,
  recordVectors,
  vocabulary,
  termVectors,
  dims,
  floor,
}: {
  recordIds: string[];
  recordVectors: Float32Array;
  vocabulary: string[];
  termVectors: Float32Array;
  dims: number;
  floor: number;
}): Record<string, Neighbour[]> {
  const languages = [...LANGUAGES].sort();
  const terms: Record<string, Neighbour[]> = {};
  vocabulary.forEach((term, i) => {
    const query = termVectors.subarray(i * dims, (i + 1) * dims);
    const neighbours = languages.flatMap((language) =>
      topK(
        recordVectors,
        dims,
        query,
        NEIGHBOURS_PER_LANGUAGE,
        (row) => (languageOf(recordIds[row]) ?? language) === language,
      )
        .filter(({ score }) => score >= floor)
        .map(({ row, score }): Neighbour => [
          recordIds[row],
          Math.round(score * 1000) / 1000,
        ]),
    );
    if (neighbours.length > 0) terms[term] = neighbours;
  });
  return terms;
}

export function neighbourStaleness(
  file: Pick<NeighbourFile, 'records' | 'vocabularyHash'>,
  records: Searchable[],
  expansions: ExpansionFile['records'],
): { stale: string[]; vocabulary: boolean } {
  const current = recordHashes(records, expansions);
  const ids = new Set([...Object.keys(current), ...Object.keys(file.records)]);
  return {
    stale: [...ids].filter((id) => current[id] !== file.records[id]).sort(),
    vocabulary:
      hashVocabulary(buildVocabulary(records, expansions)) !==
      file.vocabularyHash,
  };
}

export function serializeNeighbours(file: NeighbourFile): string {
  const sorted = (o: Record<string, unknown>) =>
    Object.keys(o)
      .sort()
      .map((key) => `    ${JSON.stringify(key)}: ${JSON.stringify(o[key])}`)
      .join(',\n');
  return [
    '{',
    `  "model": ${JSON.stringify(file.model)},`,
    `  "floor": ${file.floor},`,
    `  "vocabularyHash": ${JSON.stringify(file.vocabularyHash)},`,
    `  "records": {\n${sorted(file.records)}\n  },`,
    `  "terms": {\n${sorted(file.terms)}\n  }`,
    '}\n',
  ].join('\n');
}
