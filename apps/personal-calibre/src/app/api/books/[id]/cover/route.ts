import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { db } from '@/db/client';
import { books } from '@/db/schema';

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

  try {
    const buffer = await readWithRetry(coverPath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return new NextResponse('Not Found', { status: 404 });
  }
}
