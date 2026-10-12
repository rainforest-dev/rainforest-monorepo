import {
  type LexicalConfig,
  lexicalRank as rank,
} from '@rainforest-dev/search';

import type { SearchDoc } from './docs.ts';

const CONFIG: LexicalConfig<SearchDoc> = {
  id: (doc) => doc.id,
  text: (doc) => doc.text,
  facets: [
    { values: (doc) => doc.people, match: 'exact' },
    { values: (doc) => doc.places, match: 'substring' },
  ],
  tieBreak: (a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id),
};

export const lexicalRank = (
  docs: readonly SearchDoc[],
  terms: readonly string[],
): string[] => rank(docs, terms, CONFIG);
