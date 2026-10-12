import { fnv1a } from '@rainforest-dev/search';
import type { Database } from 'better-sqlite3';
import sanitizeHtml from 'sanitize-html';

export const COMMENTS_LIMIT = 1000;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
};

export type BookDocRow = {
  id: number;
  title: string;
  authors: string;
  series: string;
  tags: string;
  comments: string;
};

export type BookDoc = { id: string; text: string; contentHash: string };

export function stripComments(html: string): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(
      /&(amp|lt|gt|quot|#39);/g,
      (_, name: string) => ENTITIES[name] ?? '',
    )
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(text).slice(0, COMMENTS_LIMIT).join('');
}

export function bookDocText(row: BookDocRow): string {
  return [
    row.title,
    row.authors,
    row.series,
    row.tags,
    stripComments(row.comments),
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n');
}

export function toBookDoc(row: BookDocRow): BookDoc {
  const text = bookDocText(row);
  return { id: String(row.id), text, contentHash: fnv1a(text) };
}

export function readBookDocs(sqlite: Database): BookDoc[] {
  const rows = sqlite
    .prepare(
      `SELECT b.id, b.title,
              COALESCE((SELECT group_concat(a.name, ', ')
                        FROM books_authors_link bal JOIN authors a ON a.id = bal.author
                        WHERE bal.book = b.id), '') AS authors,
              COALESCE((SELECT s.name
                        FROM books_series_link bsl JOIN series s ON s.id = bsl.series
                        WHERE bsl.book = b.id), '') AS series,
              COALESCE((SELECT group_concat(t.name, ', ')
                        FROM books_tags_link btl JOIN tags t ON t.id = btl.tag
                        WHERE btl.book = b.id), '') AS tags,
              COALESCE((SELECT c.text FROM comments c WHERE c.book = b.id), '') AS comments
       FROM books b
       ORDER BY b.id`,
    )
    .all() as BookDocRow[];
  return rows.map(toBookDoc);
}
