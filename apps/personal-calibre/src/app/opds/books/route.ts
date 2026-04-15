import { type NextRequest, NextResponse } from 'next/server';

import { atomDate, buildAcquisitionEntry } from '@/lib/opds';
import { getBookList } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const page = parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10);
  const limit = 30;

  const { books, total } = await getBookList({ page, limit });
  const hasMore = page * limit < total;

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/terms/" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:uuid:calibre-opds-all-books</id>
  <title>All Books</title>
  <updated>${atomDate()}</updated>
  <link href="/opds/books?page=${page}" rel="self" type="application/atom+xml;profile=opds-catalog;kind=acquisition" />
  <link href="/opds" rel="start" type="application/atom+xml;profile=opds-catalog;kind=navigation" />`;

  if (hasMore) {
    xml += `\n  <link href="/opds/books?page=${page + 1}" rel="next" type="application/atom+xml;profile=opds-catalog;kind=acquisition" />`;
  }

  for (const book of books) {
    xml += `\n${buildAcquisitionEntry(book)
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n')}`;
  }

  xml += '\n</feed>';

  return new NextResponse(xml, {
    headers: {
      'Content-Type':
        'application/atom+xml;profile=opds-catalog;kind=acquisition;charset=utf-8',
    },
  });
}
