export function rrf(
  rankings: readonly (readonly string[])[],
  k = 60,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const ranking of rankings)
    ranking.forEach((id, i) =>
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)),
    );
  return scores;
}
