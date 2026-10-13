import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { appSqlite } from '@/db';
import { ftsRowsById, searchBookIds } from '@/lib/server';
import { FAULT_COOKIE, readTestHooks } from '@/lib/test-hooks';

export const querySchema = z.string().trim().max(200);

export const SEARCH_LIMIT = 20;

export interface SearchResult {
  id: number;
  title: string;
  author: string;
  series: string | null;
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    request.nextUrl.searchParams.get('q') ?? '',
  );
  const hooks = readTestHooks({}, request.cookies.get(FAULT_COOKIE)?.value);
  const { ids, semantic, reason } = await searchBookIds(
    parsed.success ? parsed.data : '',
    { embedFault: hooks.fault === 'embed' },
  );
  let results: SearchResult[] = [];
  try {
    results = ftsRowsById(ids, appSqlite)
      .slice(0, SEARCH_LIMIT)
      .map(({ authors, ...r }) => ({ ...r, author: authors }));
  } catch {
    results = [];
  }
  return NextResponse.json({
    results,
    semantic,
    ...(reason ? { reason } : {}),
  });
}
