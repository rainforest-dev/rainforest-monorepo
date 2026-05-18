import { revalidateTag } from 'next/cache';

import { writableSqlite } from '@/db/client';

export function getOrCreateTag(name: string): number {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tag name is required');

  // INSERT OR IGNORE is atomic — safe under concurrent requests hitting Calibre's UNIQUE index on tags.name.
  writableSqlite.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(trimmed);
  const row = writableSqlite.prepare('SELECT id FROM tags WHERE name = ?').get(trimmed) as { id: number };
  return Number(row.id);
}

export function addTagToBook(bookId: number, tagId: number): void {
  writableSqlite
    .prepare('INSERT OR IGNORE INTO books_tags_link (book, tag) VALUES (?, ?)')
    .run(bookId, tagId);
}

export function removeTagFromBook(bookId: number, tagId: number): void {
  writableSqlite
    .prepare('DELETE FROM books_tags_link WHERE book = ? AND tag = ?')
    .run(bookId, tagId);
}

export function revalidateBookTagCache(bookId: number): void {
  revalidateTag('books', 'max');
  revalidateTag('filters', 'max');
  revalidateTag(`book-${bookId}`, 'max');
}
