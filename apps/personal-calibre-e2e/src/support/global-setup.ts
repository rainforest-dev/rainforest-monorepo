import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

export default async function globalSetup() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // Remove stale app DB so syncBooksFts rebuilds cleanly on first request.
  const appDbPath = path.join(FIXTURES_DIR, 'app.db');
  if (fs.existsSync(appDbPath)) fs.unlinkSync(appDbPath);

  // Recreate Calibre metadata.db from scratch each run.
  const metaPath = path.join(FIXTURES_DIR, 'metadata.db');
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  const db = new Database(metaPath);

  // Schema — minimal Calibre tables required by the app
  db.prepare(`CREATE TABLE books (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, sort TEXT,
    timestamp TEXT, pubdate TEXT, series_index REAL, author_sort TEXT,
    path TEXT NOT NULL DEFAULT '', has_cover INTEGER DEFAULT 0,
    uuid TEXT, last_modified TEXT DEFAULT '2024-01-01T00:00:00+00:00'
  )`).run();
  db.prepare(`CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT, sort TEXT, link TEXT DEFAULT '')`).run();
  db.prepare(`CREATE TABLE books_authors_link (id INTEGER PRIMARY KEY, book INTEGER, author INTEGER)`).run();
  db.prepare(`CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT)`).run();
  db.prepare(`CREATE TABLE books_tags_link (id INTEGER PRIMARY KEY, book INTEGER, tag INTEGER)`).run();
  db.prepare(`CREATE TABLE series (id INTEGER PRIMARY KEY, name TEXT, sort TEXT)`).run();
  db.prepare(`CREATE TABLE books_series_link (id INTEGER PRIMARY KEY, book INTEGER, series INTEGER)`).run();
  db.prepare(`CREATE TABLE data (id INTEGER PRIMARY KEY, book INTEGER, format TEXT, uncompressed_size INTEGER DEFAULT 0, name TEXT)`).run();
  db.prepare(`CREATE TABLE ratings (id INTEGER PRIMARY KEY, rating INTEGER)`).run();
  db.prepare(`CREATE TABLE books_ratings_link (id INTEGER PRIMARY KEY, book INTEGER, rating INTEGER)`).run();
  db.prepare(`CREATE TABLE publishers (id INTEGER PRIMARY KEY, name TEXT, sort TEXT)`).run();
  db.prepare(`CREATE TABLE books_publishers_link (id INTEGER PRIMARY KEY, book INTEGER, publisher INTEGER)`).run();
  db.prepare(`CREATE TABLE languages (id INTEGER PRIMARY KEY, lang_code TEXT)`).run();
  db.prepare(`CREATE TABLE books_languages_link (id INTEGER PRIMARY KEY, book INTEGER, lang_code INTEGER, item_order INTEGER DEFAULT 0)`).run();
  db.prepare(`CREATE TABLE comments (id INTEGER PRIMARY KEY, book INTEGER, text TEXT)`).run();

  // Seed books (8 total for good coverage of filter/group/series scenarios)
  const insBook = db.prepare(`INSERT INTO books (id, title, sort, series_index, author_sort) VALUES (?, ?, ?, ?, ?)`);
  const bookData: [number, string, string, number | null, string][] = [
    [1, 'Dune', 'Dune', 1.0, 'Herbert, Frank'],
    [2, 'Dune Messiah', 'Dune Messiah', 2.0, 'Herbert, Frank'],
    [3, 'Foundation', 'Foundation', 1.0, 'Asimov, Isaac'],
    [4, 'Foundation and Empire', 'Foundation and Empire', 2.0, 'Asimov, Isaac'],
    [5, 'The Hobbit', 'Hobbit, The', null, 'Tolkien, J.R.R.'],
    [6, 'The Fellowship of the Ring', 'Fellowship of the Ring, The', 1.0, 'Tolkien, J.R.R.'],
    [7, 'Thinking, Fast and Slow', 'Thinking Fast and Slow', null, 'Kahneman, Daniel'],
    [8, 'Atomic Habits', 'Atomic Habits', null, 'Clear, James'],
  ];
  for (const row of bookData) insBook.run(...row);

  // Authors
  const insAuthor = db.prepare(`INSERT INTO authors (id, name, sort) VALUES (?, ?, ?)`);
  const authorData: [number, string, string][] = [
    [1, 'Frank Herbert', 'Herbert, Frank'],
    [2, 'Isaac Asimov', 'Asimov, Isaac'],
    [3, 'J.R.R. Tolkien', 'Tolkien, J.R.R.'],
    [4, 'Daniel Kahneman', 'Kahneman, Daniel'],
    [5, 'James Clear', 'Clear, James'],
  ];
  for (const row of authorData) insAuthor.run(...row);

  // Books-Authors links
  const insBA = db.prepare(`INSERT INTO books_authors_link (book, author) VALUES (?, ?)`);
  for (const [b, a] of [[1,1],[2,1],[3,2],[4,2],[5,3],[6,3],[7,4],[8,5]] as [number,number][]) insBA.run(b, a);

  // Series
  const insSeries = db.prepare(`INSERT INTO series (id, name, sort) VALUES (?, ?, ?)`);
  insSeries.run(1, 'Dune Chronicles', 'Dune Chronicles');
  insSeries.run(2, 'Foundation Series', 'Foundation Series');
  insSeries.run(3, 'The Lord of the Rings', 'Lord of the Rings, The');

  // Books-Series links
  const insBS = db.prepare(`INSERT INTO books_series_link (book, series) VALUES (?, ?)`);
  for (const [b, s] of [[1,1],[2,1],[3,2],[4,2],[6,3]] as [number,number][]) insBS.run(b, s);

  // Tags: 1=sci-fi, 2=fantasy, 3=classic, 4=nonfiction, 5=self-help
  const insTag = db.prepare(`INSERT INTO tags (id, name) VALUES (?, ?)`);
  for (const [id, name] of [[1,'sci-fi'],[2,'fantasy'],[3,'classic'],[4,'nonfiction'],[5,'self-help']] as [number,string][]) insTag.run(id, name);

  // Books-Tags
  const insBT = db.prepare(`INSERT INTO books_tags_link (book, tag) VALUES (?, ?)`);
  for (const [b, t] of [[1,1],[1,3],[2,1],[3,1],[3,3],[4,1],[5,2],[6,2],[6,3],[7,4],[8,4],[8,5]] as [number,number][]) insBT.run(b, t);

  // Formats (EPUB for all books)
  const insData = db.prepare(`INSERT INTO data (book, format, name) VALUES (?, 'EPUB', ?)`);
  for (const [id] of bookData) insData.run(id, `book${id}`);

  // Ratings: Dune→10 (5★), Foundation→10 (5★), Hobbit→8 (4★)
  db.prepare(`INSERT INTO ratings (id, rating) VALUES (1, 10)`).run();
  db.prepare(`INSERT INTO ratings (id, rating) VALUES (2, 10)`).run();
  db.prepare(`INSERT INTO ratings (id, rating) VALUES (3, 8)`).run();
  db.prepare(`INSERT INTO books_ratings_link (book, rating) VALUES (1, 1)`).run();
  db.prepare(`INSERT INTO books_ratings_link (book, rating) VALUES (3, 2)`).run();
  db.prepare(`INSERT INTO books_ratings_link (book, rating) VALUES (5, 3)`).run();

  db.close();
  console.log('[e2e] Fixture DB created at', FIXTURES_DIR);
}
