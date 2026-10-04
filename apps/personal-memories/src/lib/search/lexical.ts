import type { SearchDoc } from './docs.ts';

const fold = (s: string) => s.normalize('NFKC').toLowerCase();

const count = (haystack: string, needle: string) => {
  let n = 0;
  for (
    let i = haystack.indexOf(needle);
    i !== -1;
    i = haystack.indexOf(needle, i + needle.length)
  )
    n++;
  return n;
};

export function lexicalRank(
  docs: readonly SearchDoc[],
  terms: readonly string[],
): string[] {
  const folded = terms.map(fold).filter(Boolean);
  if (folded.length === 0) return [];
  const scored: { doc: SearchDoc; facets: number; hits: number }[] = [];
  for (const doc of docs) {
    const text = fold(doc.text);
    const people = doc.people.map(fold);
    const places = doc.places.map(fold);
    let facetHits = 0;
    let hits = 0;
    let all = true;
    for (const term of folded) {
      const inFacet =
        people.includes(term) || places.some((f) => f.includes(term));
      const inText = count(text, term);
      if (!inFacet && inText === 0) {
        all = false;
        break;
      }
      if (inFacet) facetHits++;
      hits += inText;
    }
    if (all) scored.push({ doc, facets: facetHits, hits });
  }
  return scored
    .sort(
      (x, y) =>
        y.facets - x.facets ||
        y.hits - x.hits ||
        y.doc.day.localeCompare(x.doc.day) ||
        x.doc.id.localeCompare(y.doc.id),
    )
    .map((s) => s.doc.id);
}
