import { type NextRequest, NextResponse } from 'next/server';

import { appSqlite } from '@/db/client';

interface FtsRow {
  id: number;
  title: string;
  authors: string;
  series: string | null;
}

export interface SearchResult {
  id: number;
  title: string;
  author: string;
  series: string | null;
}

// Strip characters that would break FTS5 MATCH syntax.
function sanitizeToken(t: string): string {
  return t.replace(/["'*()^:+-]/g, '').trim();
}

// N-gram similarity between query and target — recall-focused (query coverage).
// Works for both ASCII and CJK because it operates on raw characters.
function ngramSimilarity(query: string, target: string): number {
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

function scoreRow(query: string, row: FtsRow): number {
  return Math.max(
    ngramSimilarity(query, row.title),
    ngramSimilarity(query, row.authors) * 0.85,
    row.series ? ngramSimilarity(query, row.series) * 0.7 : 0,
  );
}

function normalize(rows: FtsRow[]): SearchResult[] {
  return rows.map(({ authors, ...r }) => ({ ...r, author: authors }));
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  // Phase 1: FTS5 trigram substring match — handles mixed CJK/ASCII.
  // Trigram requires each token to be ≥3 chars; skip FTS for short inputs.
  const tokens = q.split(/\s+/).map(sanitizeToken).filter((t) => t.length >= 3);
  if (tokens.length > 0) {
    try {
      const rows = appSqlite
        .prepare(
          'SELECT id, title, authors, series FROM books_fts WHERE books_fts MATCH ? ORDER BY rank LIMIT 20',
        )
        .all(tokens.join(' ')) as FtsRow[];
      if (rows.length > 0) return NextResponse.json({ results: normalize(rows) });
    } catch {
      // Malformed MATCH query or table not ready — fall through.
    }
  }

  // Phase 2: n-gram fuzzy fallback — load all rows and score in memory.
  // Handles 1–2 char queries and cases where FTS returned nothing.
  // Viable because the library is small (≤a few hundred books).
  try {
    const all = appSqlite
      .prepare('SELECT id, title, authors, series FROM books_fts')
      .all() as FtsRow[];

    const results = all
      .map((row) => ({ row, score: scoreRow(q, row) }))
      .filter(({ score }) => score >= 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(({ row }) => row);

    return NextResponse.json({ results: normalize(results) });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
