import { fold } from './text';

export function matchesAllTerms(
  fields: readonly string[],
  terms: readonly string[],
): boolean {
  const folded = fields.map(fold);
  return terms.every((term) => {
    const t = fold(term);
    return folded.some((field) => field.includes(t));
  });
}

export type Tiered = {
  title: string;
  keywords: readonly string[];
  expanded?: readonly string[] | undefined;
};

export function tieredMatch(
  query: string,
  { title, keywords, expanded = [] }: Tiered,
): number {
  const q = fold(query).trim();
  if (!q) return 1;
  const t = fold(title);
  if (t === q) return 100;
  if (t.startsWith(q)) return 75;
  if (t.includes(q)) return 50;
  const k = keywords.map(fold);
  if (k.some((word) => word === q)) return 30;
  if (k.some((word) => word.includes(q))) return 15;
  if (q.length >= 2 && expanded.some((word) => fold(word).includes(q)))
    return 5;
  return 0;
}

export function ngramSimilarity(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const grams = new Set<string>();
  for (let i = 0; i < q.length - 1; i++) {
    grams.add(q.slice(i, i + 2));
    if (i < q.length - 2) grams.add(q.slice(i, i + 3));
  }
  if (grams.size === 0) return t.includes(q) ? 1 : 0;
  let hits = 0;
  for (const g of grams) if (t.includes(g)) hits++;
  return hits / grams.size;
}
