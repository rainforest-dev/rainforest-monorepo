import { createHash } from 'node:crypto';

import { planReuse } from '@rainforest-dev/search';

import type { Searchable } from './search';

export const MAX_TERMS = 8;
export const MAX_TERM_LENGTH = 24;

export interface ExpansionEntry {
  hash: string;
  terms: string[];
}

export interface ExpansionFile {
  model: string;
  records: Record<string, ExpansionEntry>;
}

type Hashable = Pick<Searchable, 'kind' | 'title' | 'keywords'>;

export function hashRecord({ kind, title, keywords }: Hashable): string {
  return createHash('sha256')
    .update(JSON.stringify([kind, title, keywords]))
    .digest('hex')
    .slice(0, 16);
}

export const words = (text: string) =>
  text.toLowerCase().split(/[\s·,/()+\-_.]+/);

export function normalizeTerms(
  raw: string[],
  record: Pick<Searchable, 'title' | 'keywords'>,
): string[] {
  const known = new Set([
    ...words(record.title),
    ...record.keywords.flatMap(words),
    record.title.toLowerCase(),
    ...record.keywords.map((k) => k.toLowerCase()),
  ]);
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const candidate of raw) {
    const term = candidate.trim();
    const key = term.toLowerCase();
    if (!term || term.length > MAX_TERM_LENGTH) continue;
    if (known.has(key) || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length === MAX_TERMS) break;
  }
  return terms;
}

export function planExpansion(
  records: Searchable[],
  existing: ExpansionFile['records'],
): { keep: ExpansionFile['records']; pending: Searchable[] } {
  const { reuse, missing } = planReuse(
    Object.entries(existing).map(([id, { hash }]) => ({ id, hash })),
    records.map((record) => ({ id: record.id, hash: hashRecord(record) })),
  );
  const keep: ExpansionFile['records'] = {};
  for (const current of reuse.keys()) {
    const { id } = records[current];
    keep[id] = existing[id];
  }
  return { keep, pending: missing.map((i) => records[i]) };
}

export function serializeExpansions(file: ExpansionFile): string {
  const records = Object.fromEntries(
    Object.keys(file.records)
      .sort()
      .map((id) => [id, file.records[id]]),
  );
  return `${JSON.stringify({ model: file.model, records }, null, 2)}\n`;
}
