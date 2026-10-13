import { fold } from './text';

export type Facet<D> = {
  values(doc: D): readonly string[];
  match: 'exact' | 'substring';
};

export type LexicalConfig<D> = {
  id(doc: D): string;
  text(doc: D): string;
  facets?: readonly Facet<D>[];
  tieBreak?(a: D, b: D): number;
};

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

export function lexicalRank<D>(
  docs: readonly D[],
  terms: readonly string[],
  config: LexicalConfig<D>,
): string[] {
  const folded = terms.map(fold).filter(Boolean);
  if (folded.length === 0) return [];
  const facets = config.facets ?? [];
  const scored: { doc: D; facets: number; hits: number }[] = [];
  for (const doc of docs) {
    const text = fold(config.text(doc));
    const values = facets.map((f) => ({
      match: f.match,
      values: f.values(doc).map(fold),
    }));
    let facetHits = 0;
    let hits = 0;
    let all = true;
    for (const term of folded) {
      const inFacet = values.some(({ match, values: vs }) =>
        match === 'exact'
          ? vs.includes(term)
          : vs.some((v) => v.includes(term)),
      );
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
        (config.tieBreak?.(x.doc, y.doc) ?? 0),
    )
    .map((s) => config.id(s.doc));
}
