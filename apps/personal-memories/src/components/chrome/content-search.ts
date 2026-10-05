import type { SearchQuery } from '@/lib/search';

export const MAX_QUERY = 200;
export const DEBOUNCE_MS = 250;

const HAN = /\p{Script=Han}/u;
const LATIN = /[\p{L}\p{N}]/gu;

export function shouldSearch(query: SearchQuery, composing: boolean): boolean {
  if (composing) return false;
  const text = query.text.trim();
  if (!text) return Boolean(query.people?.length);
  return HAN.test(text) || (text.match(LATIN)?.length ?? 0) >= 2;
}

export function searchUrl(query: SearchQuery): string {
  const params = new URLSearchParams({
    q: Array.from(query.text.trim()).slice(0, MAX_QUERY).join(''),
  });
  if (query.range) {
    params.set('from', query.range.start);
    params.set('to', query.range.end);
  }
  if (query.people?.length) params.set('people', query.people.join(','));
  if (query.sources?.length) params.set('sources', query.sources.join(','));
  return `/search.json?${params}`;
}
