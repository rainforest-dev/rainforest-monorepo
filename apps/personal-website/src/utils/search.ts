export interface Searchable {
  id: string;
  kind: 'experience' | 'project' | 'skill' | 'post';
  title: string;
  keywords: string[];
  href: string;
}

/**
 * Scored substring matching, deliberately not a fuzzy-search library. The whole corpus is a few
 * hundred rows — roughly seven roles, four projects, fifteen skills and a handful of posts — so
 * a dependency would cost more than it buys, and this stays synchronous and trivially testable.
 *
 * Higher is better; 0 means no match.
 */
export function scoreMatch(
  query: string,
  title: string,
  keywords: string[],
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const t = title.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 75;
  if (t.includes(q)) return 50;
  if (keywords.some((k) => k.toLowerCase() === q)) return 30;
  if (keywords.some((k) => k.toLowerCase().includes(q))) return 15;
  return 0;
}

/** Matching records, best first. An empty query returns everything so the palette opens populated. */
export function searchRecords<T extends Searchable>(
  query: string,
  records: T[],
): T[] {
  return (
    records
      .map((record) => ({
        record,
        score: scoreMatch(query, record.title, record.keywords),
      }))
      .filter(({ score }) => score > 0)
      // Array.prototype.sort is stable, so equal scores keep their input order rather than
      // shuffling between renders.
      .sort((a, b) => b.score - a.score)
      .map(({ record }) => record)
  );
}
