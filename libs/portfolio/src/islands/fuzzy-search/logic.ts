/**
 * Cosmetic stand-in for fuse.js's scoring model: 0 is a perfect match, 1 is
 * "matches almost anything". Prefix and substring hits score low; a
 * character-order (subsequence) match with gaps scores higher; anything
 * that isn't even a subsequence returns Infinity so it's always filtered.
 */
function scoreOf(query: string, item: string): number {
  const q = query.toLowerCase();
  const s = item.toLowerCase();
  if (s === q) return 0;

  const idx = s.indexOf(q);
  if (idx === 0) return 0.02;
  if (idx > 0) return 0.05 + (idx / s.length) * 0.05;

  let searchFrom = 0;
  let lastMatch = -1;
  let gaps = 0;
  for (const char of q) {
    const found = s.indexOf(char, searchFrom);
    if (found === -1) return Infinity;
    if (lastMatch !== -1) gaps += found - lastMatch - 1;
    lastMatch = found;
    searchFrom = found + 1;
  }
  return Math.min(1, 0.15 + gaps / Math.max(s.length, q.length));
}

/**
 * Client-side fuzzy match mirroring fuse.js at threshold 0.1: best matches
 * first, anything scoring above `threshold` is dropped. An empty (or
 * whitespace-only) query short-circuits to the full, unranked list.
 */
export function rank(
  query: string,
  items: string[],
  threshold = 0.1,
): string[] {
  if (query.trim().length === 0) return [...items];

  return items
    .map((item) => ({ item, score: scoreOf(query, item) }))
    .filter(({ score }) => score <= threshold)
    .sort((a, b) => a.score - b.score)
    .map(({ item }) => item);
}
