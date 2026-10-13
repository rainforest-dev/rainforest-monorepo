import { fold, rrf } from '@rainforest-dev/search';

export const MIN_LOOKUP_LENGTH = 2;

export type Neighbour = [recordId: string, score: number];

export interface NeighbourFile {
  model: string;
  floor: number;
  records: Record<string, string>;
  vocabularyHash: string;
  terms: Record<string, Neighbour[]>;
}

export function neighbourRanking(
  query: string,
  file: Pick<NeighbourFile, 'terms'>,
): string[] {
  const q = fold(query).trim();
  if ([...q].length < MIN_LOOKUP_LENGTH) return [];
  const best = new Map<string, number>();
  for (const [term, neighbours] of Object.entries(file.terms)) {
    if (!term.startsWith(q)) continue;
    for (const [id, score] of neighbours)
      best.set(id, Math.max(best.get(id) ?? -Infinity, score));
  }
  return [...best]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([id]) => id);
}

export function fuseRankings(
  tiered: readonly { id: string; score: number }[],
  neighbours: readonly string[],
): string[] {
  const ids = tiered.map(({ id }) => id);
  if (neighbours.length === 0) return ids;
  const fused = rrf([ids, neighbours]);
  const known = new Set(ids);
  const lexical = [...tiered].sort(
    (a, b) =>
      b.score - a.score || (fused.get(b.id) ?? 0) - (fused.get(a.id) ?? 0),
  );
  return [
    ...lexical.map(({ id }) => id),
    ...neighbours.filter((id) => !known.has(id)),
  ];
}
