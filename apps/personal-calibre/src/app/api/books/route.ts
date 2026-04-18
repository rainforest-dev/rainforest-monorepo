import { type NextRequest, NextResponse } from 'next/server';

import { getBookList } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30') || 30, 100);
  const q = searchParams.get('q') ?? undefined;
  const authorId = parseInt(searchParams.get('author') ?? '') || undefined;
  const tagId = parseInt(searchParams.get('tag') ?? '') || undefined;
  const seriesId = parseInt(searchParams.get('series') ?? '') || undefined;

  const result = await getBookList({ page, limit, q, authorId, tagId, seriesId });

  return NextResponse.json(result);
}
