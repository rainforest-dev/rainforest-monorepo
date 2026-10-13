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
  tiered: readonly string[],
  neighbours: readonly string[],
): string[] {
  if (neighbours.length === 0) return [...tiered];
  const known = new Set(tiered);
  const added = neighbours.filter((id) => !known.has(id));
  const scores = rrf([tiered, neighbours]);
  const order = [...tiered, ...added];
  const position = new Map(order.map((id, i) => [id, i]));
  return order.sort(
    (a, b) =>
      (scores.get(b) ?? 0) - (scores.get(a) ?? 0) ||
      (position.get(a) ?? 0) - (position.get(b) ?? 0),
  );
}
