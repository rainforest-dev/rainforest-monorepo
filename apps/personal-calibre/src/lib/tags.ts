import { revalidateTag } from 'next/cache';

import { writableSqlite } from '@/db/client';

export function getOrCreateTag(name: string): number {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tag name is required');

  const existing = writableSqlite
    .prepare('SELECT id FROM tags WHERE name = ?')
    .get(trimmed) as { id: number } | undefined;
  if (existing) return existing.id;

  const result = writableSqlite.prepare('INSERT INTO tags (name) VALUES (?)').run(trimmed);
  return result.lastInsertRowid as number;
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
