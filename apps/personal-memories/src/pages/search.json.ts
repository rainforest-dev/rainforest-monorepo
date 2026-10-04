import type { APIRoute } from 'astro';

import {
  breaker,
  embedderFromEnv,
  getNoteVectors,
  getSearchIndex,
  handleSearch,
} from '@/lib/server';

const embedder = embedderFromEnv();
const gate = breaker();

export const GET: APIRoute = ({ url }) =>
  handleSearch(url, {
    index: async () => {
      const index = await getSearchIndex();
      return index && { ...index, extra: getNoteVectors() };
    },
    embedder,
    breaker: gate,
  });
