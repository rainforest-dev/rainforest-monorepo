import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { db } from '@/db/client';
import { books, data } from '@/db/schema';

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

  const filePath = path.join(
    process.env.CALIBRE_LIBRARY_PATH,
    book.path,
    `${fileRow.name}.${fmt.toLowerCase()}`,
  );

  if (!existsSync(filePath)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const nodeStream = createReadStream(filePath);
  // Cast through unknown to bridge the Node.js and DOM ReadableStream type gap
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  const filename = `${fileRow.name}.${format.toLowerCase()}`;

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': MIME_TYPES[format.toLowerCase()] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
