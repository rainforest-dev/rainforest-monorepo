import { type NextRequest, NextResponse } from 'next/server';

import { getBookList } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = Number(searchParams.get('page') ?? 1);
  const limit = Math.min(Number(searchParams.get('limit') ?? 30), 100);
  const q = searchParams.get('q') ?? undefined;
  const authorId = searchParams.has('author') ? Number(searchParams.get('author')) : undefined;
  const tagId = searchParams.has('tag') ? Number(searchParams.get('tag')) : undefined;
  const seriesId = searchParams.has('series') ? Number(searchParams.get('series')) : undefined;

  const result = await getBookList({ page, limit, q, authorId, tagId, seriesId });

  return NextResponse.json(result);
}
