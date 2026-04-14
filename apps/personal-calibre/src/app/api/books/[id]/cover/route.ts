import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { db } from '@/db/client';
import { books } from '@/db/schema';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = Number(id);

  const book = await db
    .select({ path: books.path })
    .from(books)
    .where(eq(books.id, bookId))
    .get();

  if (!book) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const coverPath = path.join(
    process.env.CALIBRE_LIBRARY_PATH,
    book.path,
    'cover.jpg',
  );

  if (!existsSync(coverPath)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const buffer = await readFile(coverPath);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
