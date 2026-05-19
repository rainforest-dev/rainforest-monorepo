import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { db } from '@/db/client';
import { books, data } from '@/db/schema';

async function readWithRetry(filePath: string, attempts = 5): Promise<Buffer> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await readFile(filePath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const errno = (err as NodeJS.ErrnoException).errno;
      // errno -35 = EAGAIN: Synology Drive VirtioFS online-only file not yet cached locally.
      // First failed read triggers FileProvider to download the file; retry after delay.
      if ((code === 'EAGAIN' || errno === -35) && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}

const MIME_TYPES: Record<string, string> = {
  epub: 'application/epub+zip',
  pdf: 'application/pdf',
  mobi: 'application/x-mobipocket-ebook',
  azw: 'application/vnd.amazon.ebook',
  azw3: 'application/vnd.amazon.ebook',
  txt: 'text/plain',
  rtf: 'application/rtf',
  djvu: 'image/vnd.djvu',
  cbz: 'application/vnd.comicbook+zip',
  cbr: 'application/vnd.comicbook-rar',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; format: string }> },
) {
  const { id, format } = await params;
  const bookId = Number(id);
  const fmt = format.toUpperCase();

  const [book, fileRow] = await Promise.all([
    db
      .select({ path: books.path, title: books.title })
      .from(books)
      .where(eq(books.id, bookId))
      .get(),
    db
      .select({ name: data.name, format: data.format })
      .from(data)
      .where(and(eq(data.book, bookId), eq(data.format, fmt)))
      .get(),
  ]);

  if (!book || !fileRow) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const libraryPath = process.env.CALIBRE_LIBRARY_PATH;
  if (!libraryPath) {
    return new NextResponse('Server misconfiguration', { status: 500 });
  }

  const libraryRoot = path.resolve(libraryPath);
  const filePath = path.resolve(libraryRoot, book.path, `${fileRow.name}.${fmt.toLowerCase()}`);
  if (!filePath.startsWith(libraryRoot + path.sep)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  if (!existsSync(filePath)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const filename = `${fileRow.name}.${format.toLowerCase()}`;

  try {
    const buffer = await readWithRetry(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': MIME_TYPES[format.toLowerCase()] ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
