import { ngramSimilarity } from '@rainforest-dev/search';
import type { Database } from 'better-sqlite3';

export interface FtsRow {
  id: number;
  title: string;
  authors: string;
  series: string | null;
}

const NGRAM_FLOOR = 0.25;

function sanitizeToken(t: string): string {
  return t.replace(/["'*()^:+-]/g, '').trim();
}

function scoreRow(query: string, row: FtsRow): number {
  return Math.max(
    ngramSimilarity(query, row.title),
    ngramSimilarity(query, row.authors) * 0.85,
    row.series ? ngramSimilarity(query, row.series) * 0.7 : 0,
  );
}

export function lexicalBookIds(q: string, sqlite: Database): number[] {
  const tokens = q
    .split(/\s+/)
    .map(sanitizeToken)
    .filter((t) => t.length >= 3);
  if (tokens.length > 0) {
    try {
      const rows = sqlite
        .prepare(
          'SELECT id FROM books_fts WHERE books_fts MATCH ? ORDER BY rank',
        )
        .all(tokens.join(' ')) as Pick<FtsRow, 'id'>[];
      if (rows.length > 0) return rows.map((r) => Number(r.id));
    } catch {
      // FTS5 rejects some MATCH strings even after sanitizing; the n-gram pass still answers.
    }
  }
  try {
    const all = sqlite
      .prepare('SELECT id, title, authors, series FROM books_fts')
      .all() as FtsRow[];
    return all
      .map((row) => ({ row, score: scoreRow(q, row) }))
      .filter(({ score }) => score >= NGRAM_FLOOR)
      .sort((a, b) => b.score - a.score)
      .map(({ row }) => Number(row.id));
  } catch {
    return [];
  }
}

export function ftsRowsById(
  ids: readonly number[],
  sqlite: Database,
): FtsRow[] {
  if (ids.length === 0) return [];
  const rows = sqlite
    .prepare(
      `SELECT id, title, authors, series FROM books_fts WHERE id IN (${ids.map(() => '?').join(', ')})`,
    )
    .all(...ids) as FtsRow[];
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}
