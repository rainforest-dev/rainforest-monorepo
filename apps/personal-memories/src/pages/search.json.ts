import type { APIRoute } from 'astro';

import {
  breaker,
  embedderFromEnv,
  getSearchIndex,
  handleSearch,
} from '@/lib/server';

const embedder = embedderFromEnv();
const gate = breaker();

export const GET: APIRoute = ({ url }) =>
  handleSearch(url, { index: getSearchIndex, embedder, breaker: gate });
