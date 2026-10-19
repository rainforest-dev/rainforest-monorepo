import { fold, lexicalRank, whitespaceTerms } from '@rainforest-dev/search';

import { type KbDoc } from './model';

/** A document with the plain text the search reads. */
export interface KbEntry {
  doc: KbDoc;
  text: string;
}

export interface KbHit {
  doc: KbDoc;
  snippet: string;
}

const SNIPPET_RADIUS = 80;

/** Up to 160 characters of text around the first term it contains. */
export function snippetFor(text: string, terms: readonly string[]): string {
  const folded = fold(text);
  const positions = terms
    .map((t) => folded.indexOf(fold(t)))
    .filter((i) => i !== -1);
  const at = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + SNIPPET_RADIUS);
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
}

/** Every entry containing every term, best first: title and tag hits, then text hits. */
export function searchKb(
  entries: readonly KbEntry[],
  query: string,
  limit = 50,
): KbHit[] {
  const terms = whitespaceTerms(query);
  if (terms.length === 0) return [];
  const byId = new Map(entries.map((e) => [e.doc.id, e]));
  const ids = lexicalRank(entries, terms, {
    id: (e) => e.doc.id,
    text: (e) => `${e.doc.title}\n${e.text}`,
    facets: [
      { values: (e) => [e.doc.title, ...e.doc.tags], match: 'substring' },
    ],
    tieBreak: (a, b) => a.doc.title.localeCompare(b.doc.title),
  });
  return ids.slice(0, limit).flatMap((id) => {
    const entry = byId.get(id);
    return entry
      ? [{ doc: entry.doc, snippet: snippetFor(entry.text, terms) }]
      : [];
  });
}
