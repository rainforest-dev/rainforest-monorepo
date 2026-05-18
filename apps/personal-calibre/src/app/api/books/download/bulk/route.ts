import { existsSync } from 'node:fs';

import { eq, inArray } from 'drizzle-orm';
import { zip } from 'fflate';
import { type NextRequest, NextResponse } from 'next/server';

import { db } from '@/db/client';
import { books, data } from '@/db/schema';
import { readWithRetry, resolveFilePath } from '@/lib/files';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { bookIds?: unknown; format?: string };

  if (!Array.isArray(body.bookIds) || body.bookIds.length === 0) {
    return NextResponse.json({ error: 'bookIds must be a non-empty array' }, { status: 400 });
  }

  const bookIds = body.bookIds as number[];
  if (bookIds.some((id) => !Number.isInteger(id))) {
    return NextResponse.json({ error: 'All bookIds must be integers' }, { status: 400 });
  }

  const format = (body.format ?? 'EPUB').toUpperCase();

  const libraryPath = process.env.CALIBRE_LIBRARY_PATH;
  if (!libraryPath) {
    return new NextResponse('Server misconfiguration', { status: 500 });
  }

  const rows = await db
    .select({ bookPath: books.path, name: data.name, format: data.format })
    .from(data)
    .innerJoin(books, eq(books.id, data.book))
    .where(inArray(data.book, bookIds));

  // Filter to the requested format.
  const matching = rows.filter((r) => r.format === format);

  if (matching.length === 0) {
    return NextResponse.json({ error: `No ${format} files found for the selected books` }, { status: 404 });
  }

  // Read all files into memory and assemble the ZIP.
  const fileMap: Record<string, Uint8Array> = {};

  await Promise.all(
    matching.map(async (row) => {
      const ext = format.toLowerCase();
      if (!row.name) return;
      const filePath = resolveFilePath(libraryPath, row.bookPath, row.name, ext);
      if (!existsSync(filePath)) return;
      try {
        const buf = await readWithRetry(filePath);
        const filename = `${row.name}.${ext}`;
        fileMap[filename] = new Uint8Array(buf);
      } catch {
        // Skip files that fail to read; the ZIP will contain whatever succeeded.
      }
    }),
  );

  if (Object.keys(fileMap).length === 0) {
    return NextResponse.json({ error: 'No files could be read' }, { status: 500 });
  }

  const zipBuffer = await new Promise<Uint8Array>((resolve, reject) => {
    zip(fileMap, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  return new NextResponse(Buffer.from(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="books.zip"',
    },
  });
}
