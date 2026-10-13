import { tieredMatch } from '@rainforest-dev/search';

export interface Searchable {
  id: string;
  kind: 'experience' | 'project' | 'skill' | 'post';
  title: string;
  keywords: string[];
  expanded?: string[];
  href: string;
}

export function scoreMatch(
  query: string,
  title: string,
  keywords: string[],
  expanded: string[] = [],
): number {
  return tieredMatch(query, { title, keywords, expanded });
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
        score: scoreMatch(
          query,
          record.title,
          record.keywords,
          record.expanded,
        ),
      }))
      .filter(({ score }) => score > 0)
      // Array.prototype.sort is stable, so equal scores keep their input order rather than
      // shuffling between renders.
      .sort((a, b) => b.score - a.score)
      .map(({ record }) => record)
  );
}
