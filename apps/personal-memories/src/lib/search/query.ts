import { parseDateQuery } from '@/lib/natural-date.ts';
import type { Person } from '@/lib/people.ts';
import type { TimelineSource } from '@/lib/server';

import { trimEdges } from './terms.ts';

export type SearchQuery = {
  text: string;
  range?: { start: string; end: string };
  people?: string[];
  sources?: TimelineSource[];
};

const HAN = /\p{Script=Han}/u;
const MAX_DATE_CHARS = 16;
const FILLER_TOKENS = new Set(['的', '說的']);

function takeDate(
  text: string,
  today: string,
): { range: { start: string; end: string }; rest: string } | undefined {
  const max = Math.min(MAX_DATE_CHARS, text.length);
  const parse = (part: string) =>
    parseDateQuery(part.replace(/\s+/gu, ''), today);
  for (let n = max; n > 0; n--) {
    const range = parse(text.slice(0, n));
    if (range) return { range, rest: text.slice(n) };
  }
  for (let n = max; n > 0; n--) {
    const range = parse(text.slice(text.length - n));
    if (range) return { range, rest: text.slice(0, text.length - n) };
  }
  return undefined;
}

const YEAR_TOKEN = /^(\d{4})年?$/u;

function takeYear(
  text: string,
): { range: { start: string; end: string }; rest: string } | undefined {
  const tokens = text.split(/\s+/u).filter(Boolean);
  for (const at of [0, tokens.length - 1]) {
    const year = YEAR_TOKEN.exec(tokens[at] ?? '')?.[1];
    if (!year || tokens.length < 2) continue;
    const rest = tokens.filter((_, i) => i !== at).join(' ');
    return { range: { start: `${year}-01-01`, end: `${year}-12-31` }, rest };
  }
  return undefined;
}

function namesOf(people: readonly Person[]) {
  return people
    .flatMap((p) =>
      [p.name, ...Object.values(p.aliases).flat()]
        .filter((n): n is string => Boolean(n))
        .map((n) => ({ id: p.id, name: n.normalize('NFKC') })),
    )
    .sort((a, b) => b.name.length - a.name.length);
}

export function localParser(
  raw: string,
  today: string,
  people: readonly Person[],
): SearchQuery {
  const query: SearchQuery = { text: '' };
  let rest = raw.normalize('NFKC').trim();
  const date = takeDate(rest, today) ?? takeYear(rest);
  if (date) {
    query.range = date.range;
    rest = date.rest;
  }
  const ids: string[] = [];
  const add = (id: string) => {
    if (!ids.includes(id)) ids.push(id);
  };
  const names = namesOf(people);
  for (const { id, name } of names) {
    if (HAN.test(name) && rest.includes(name)) {
      rest = rest.split(name).join(' ');
      add(id);
    }
  }
  const latin = new Map(
    names
      .filter(({ name }) => !HAN.test(name))
      .map(({ id, name }) => [name.toLowerCase(), id]),
  );
  const kept: string[] = [];
  for (const token of rest.split(/\s+/u).filter(Boolean)) {
    const id = latin.get(trimEdges(token).toLowerCase());
    if (id) add(id);
    else if (!FILLER_TOKENS.has(token)) kept.push(token);
  }
  if (kept[0]?.startsWith('說的')) kept[0] = kept[0].slice(2);
  if (ids.length) query.people = ids;
  query.text = kept.filter(Boolean).join(' ');
  return query;
}
