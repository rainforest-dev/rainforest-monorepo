import { NextResponse } from 'next/server';

import { atomDate } from '@/lib/opds';

export async function GET() {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/terms/" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:uuid:calibre-opds-catalog</id>
  <title>Personal Calibre Library</title>
  <updated>${atomDate()}</updated>
  <author>
    <name>Rainforest Calibre Server</name>
  </author>
  <link href="/opds" rel="self" type="application/atom+xml;profile=opds-catalog;kind=navigation" />
  <link href="/opds" rel="start" type="application/atom+xml;profile=opds-catalog;kind=navigation" />
  <entry>
    <title>All Books</title>
    <id>urn:uuid:calibre-opds-all-books</id>
    <updated>${atomDate()}</updated>
    <link href="/opds/books" type="application/atom+xml;profile=opds-catalog;kind=acquisition" />
    <content type="text">Browse all books in the library</content>
  </entry>
</feed>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type':
        'application/atom+xml;profile=opds-catalog;kind=navigation;charset=utf-8',
    },
  });
}
