import type { BookDetail, BookSummary } from '@/types/calibre';

export function atomDate(date?: string | Date | null): string {
  if (!date) return new Date().toISOString();
  try {
    return new Date(date).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function buildAcquisitionEntry(
  book: BookSummary | BookDetail,
  isSingle = false,
): string {
  const authorTags = book.authors
    .map((a) => `<author><name>${escapeXml(a)}</name></author>`)
    .join('');

  let entry = `<entry>
  <title>${escapeXml(book.title)}</title>
  <id>urn:uuid:calibre-book-${book.id}</id>
  <updated>${atomDate((book as BookDetail).pubdate)}</updated>
  ${authorTags}`;

  const description = (book as BookDetail).description;
  if (description) {
    entry += `\n  <content type="html">${escapeXml(description)}</content>`;
  }

  if (book.hasCover) {
    entry += `\n  <link href="/api/books/${book.id}/cover" rel="http://opds-spec.org/image" type="image/jpeg" />`;
    entry += `\n  <link href="/api/books/${book.id}/cover" rel="http://opds-spec.org/image/thumbnail" type="image/jpeg" />`;
  }

  for (const format of book.formats) {
    const mime = getMimeType(format);
    entry += `\n  <link href="/api/books/${book.id}/download/${format.toLowerCase()}" rel="http://opds-spec.org/acquisition" type="${mime}" />`;
  }

  if (!isSingle) {
    entry += `\n  <link href="/opds/books/${book.id}" type="application/atom+xml;type=entry;profile=opds-catalog" rel="alternate" />`;
  }

  entry += '\n</entry>';
  return entry;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function getMimeType(format: string): string {
  switch (format.toUpperCase()) {
    case 'EPUB':
      return 'application/epub+zip';
    case 'PDF':
      return 'application/pdf';
    case 'MOBI':
      return 'application/x-mobipocket-ebook';
    case 'AZW3':
      return 'application/vnd.amazon.mobi8-ebook';
    default:
      return 'application/octet-stream';
  }
}
