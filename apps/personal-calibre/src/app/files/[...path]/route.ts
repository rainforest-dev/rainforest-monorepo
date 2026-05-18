import { existsSync } from 'node:fs';

import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { db } from '@/db/client';
import { books, data } from '@/db/schema';
import { MIME_TYPES, readWithRetry, resolveFilePath } from '@/lib/files';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;

  if (!segments || segments.length < 2) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const lastSegment = segments[segments.length - 1];
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex === -1) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const stem = lastSegment.slice(0, dotIndex);
  const ext = lastSegment.slice(dotIndex + 1).toLowerCase();
  const bookPath = segments.slice(0, -1).join('/');
  const fmt = ext.toUpperCase();

  const libraryPath = process.env.CALIBRE_LIBRARY_PATH;
  if (!libraryPath) {
    return new NextResponse('Server misconfiguration', { status: 500 });
  }

  // Validate against DB to prevent path traversal — only serve files recorded in Calibre.
  const row = await db
    .select({ bookPath: books.path, name: data.name })
    .from(data)
    .innerJoin(books, eq(books.id, data.book))
    .where(and(eq(books.path, bookPath), eq(data.name, stem), eq(data.format, fmt)))
    .get();

  if (!row) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const filePath = resolveFilePath(libraryPath, bookPath, stem, ext);

  if (!existsSync(filePath)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const buffer = await readWithRetry(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(`${stem}.${ext}`)}"`,
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
