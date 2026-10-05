import type { APIRoute } from 'astro';

import {
  breaker,
  getNoteVectors,
  getSearchIndex,
  handleSearch,
  sharedEmbedders,
} from '@/lib/server';

const embedder = sharedEmbedders().foreground;
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
