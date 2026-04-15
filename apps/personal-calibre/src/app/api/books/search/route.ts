import { type NextRequest, NextResponse } from 'next/server';

import { sqlite } from '@/db/client';

interface FtsRow {
  id: number;
  title: string;
  author: string;
  series: string | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const stmt = sqlite.prepare(
    `SELECT id, title, author, series
     FROM books_search_fts
     WHERE books_search_fts MATCH ?
     ORDER BY rank
     LIMIT 20`,
  );

  const results = stmt.all(`${q}*`) as FtsRow[];

  return NextResponse.json({ results });
}
