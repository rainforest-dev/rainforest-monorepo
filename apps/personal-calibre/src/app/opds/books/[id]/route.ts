import { type NextRequest, NextResponse } from 'next/server';

import { buildAcquisitionEntry } from '@/lib/opds';
import { getBook } from '@/lib/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bookId = parseInt(id, 10);

  if (isNaN(bookId)) {
    return new NextResponse('Invalid ID', { status: 400 });
  }

  const book = await getBook(bookId);

  if (!book) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
${buildAcquisitionEntry(book, true)}`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type':
        'application/atom+xml;type=entry;profile=opds-catalog;charset=utf-8',
    },
  });
}
