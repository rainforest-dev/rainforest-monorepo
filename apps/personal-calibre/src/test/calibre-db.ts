import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

export interface TestBook {
  id: number;
  title: string;
  authorIds: number[];
  seriesId?: number;
  seriesIndex?: number;
  tagIds?: number[];
  pubdate?: string;
}

export interface TestLibrary {
  authors: Array<[number, string, string]>;
  series: Array<[number, string]>;
  tags: Array<[number, string]>;
  books: TestBook[];
}

const DDL = `
CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT NOT NULL, sort TEXT,
  timestamp TEXT, pubdate TEXT, series_index REAL, author_sort TEXT,
  path TEXT NOT NULL DEFAULT '', has_cover INTEGER DEFAULT 0, uuid TEXT,
  last_modified TEXT);
CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT, sort TEXT, link TEXT DEFAULT '');
CREATE TABLE books_authors_link (id INTEGER PRIMARY KEY, book INTEGER, author INTEGER);
CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT UNIQUE);
CREATE TABLE books_tags_link (id INTEGER PRIMARY KEY, book INTEGER, tag INTEGER);
CREATE TABLE series (id INTEGER PRIMARY KEY, name TEXT, sort TEXT);
CREATE TABLE books_series_link (id INTEGER PRIMARY KEY, book INTEGER, series INTEGER);
CREATE TABLE data (id INTEGER PRIMARY KEY, book INTEGER, format TEXT,
  uncompressed_size INTEGER DEFAULT 0, name TEXT);
CREATE TABLE ratings (id INTEGER PRIMARY KEY, rating INTEGER);
CREATE TABLE books_ratings_link (id INTEGER PRIMARY KEY, book INTEGER, rating INTEGER);
`;

export function createCalibreDb(library: TestLibrary): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calibre-test-'));
  const db = new Database(path.join(dir, 'metadata.db'));
  try {
    db.exec(DDL);
    for (const [id, name, sort] of library.authors) {
      db.prepare('INSERT INTO authors (id, name, sort) VALUES (?, ?, ?)').run(
        id,
        name,
        sort,
      );
    }
    for (const [id, name] of library.series) {
      db.prepare('INSERT INTO series (id, name, sort) VALUES (?, ?, ?)').run(
        id,
        name,
        name,
      );
    }
    for (const [id, name] of library.tags) {
      db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)').run(id, name);
    }
    for (const book of library.books) {
      db.prepare(
        `INSERT INTO books (id, title, sort, pubdate, series_index, path, last_modified)
         VALUES (?, ?, ?, ?, ?, ?, '2026-01-01T00:00:00+00:00')`,
      ).run(
        book.id,
        book.title,
        book.title,
        book.pubdate ?? null,
        book.seriesIndex ?? null,
        `b${book.id}`,
      );
      for (const author of book.authorIds) {
        db.prepare(
          'INSERT INTO books_authors_link (book, author) VALUES (?, ?)',
        ).run(book.id, author);
      }
      if (book.seriesId) {
        db.prepare(
          'INSERT INTO books_series_link (book, series) VALUES (?, ?)',
        ).run(book.id, book.seriesId);
      }
      for (const tag of book.tagIds ?? []) {
        db.prepare('INSERT INTO books_tags_link (book, tag) VALUES (?, ?)').run(
          book.id,
          tag,
        );
      }
      db.prepare(
        "INSERT INTO data (book, format, name) VALUES (?, 'EPUB', ?)",
      ).run(book.id, `b${book.id}`);
    }
  } finally {
    db.close();
  }
  return dir;
}
