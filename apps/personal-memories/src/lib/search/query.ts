import { z } from 'astro/zod';

import { parseDateQuery } from '@/lib/natural-date.ts';
import type { Person } from '@/lib/people.ts';
import type { TimelineSource } from '@/lib/server';

export type SearchQuery = {
  text: string;
  range?: { start: string; end: string };
  people?: string[];
  sources?: TimelineSource[];
};

export const searchQuerySchema = z.object({
  text: z.string().max(200),
  range: z.object({ start: z.iso.date(), end: z.iso.date() }).optional(),
  people: z.array(z.string()).optional(),
  sources: z.array(z.enum(['line', 'slack', 'photo'])).optional(),
});

export const SEARCH_QUERY_JSON_SCHEMA = z.toJSONSchema(searchQuerySchema);

const FILLER = /^(說的|的)|(說的|的)$/g;

function personId(
  token: string,
  people: readonly Person[],
): string | undefined {
  const t = token.toLowerCase();
  return people.find(
    (p) =>
      p.name.toLowerCase() === t ||
      Object.values(p.aliases).some((list) =>
        list?.some((a) => a.toLowerCase() === t),
      ),
  )?.id;
}

export function localParser(
  raw: string,
  today: string,
  people: readonly Person[],
): SearchQuery {
  const tokens = raw.trim().split(/\s+/u).filter(Boolean);
  const query: SearchQuery = { text: '' };
  let start = 0;
  for (let end = tokens.length; end > 0; end--) {
    const range = parseDateQuery(tokens.slice(0, end).join(''), today);
    if (range) {
      query.range = range;
      start = end;
      break;
    }
  }
  const ids: string[] = [];
  const rest: string[] = [];
  for (const token of tokens.slice(start)) {
    const id = personId(token, people);
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else rest.push(token);
  }
  if (ids.length) query.people = ids;
  query.text = rest.join(' ').replace(FILLER, '').trim();
  return query;
}
