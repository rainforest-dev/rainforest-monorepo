import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

export const FIXTURES_DIR = path.join(
  __dirname,
  '..',
  '..',
  'test-output',
  'fixtures',
);
export const METADATA_DB_PATH = path.join(FIXTURES_DIR, 'metadata.db');
export const APP_DB_PATH = path.join(FIXTURES_DIR, 'app.db');

export type FixtureSize = 'small' | 'large';

export interface SeedBook {
  id: number;
  title: string;
  sort: string;
  authorIds: number[];
  seriesId: number | null;
  seriesIndex: number | null;
  tagIds: number[];
  formats: string[];
  pubdate: string;
  added: string;
  rating: number | null;
  publisherId: number;
  language: 'eng' | 'zho';
  description: string | null;
}

export const AUTHORS = [
  { id: 1, name: 'Mara Ostrand', sort: 'Ostrand, Mara' },
  { id: 2, name: 'Tobiah Quell', sort: 'Quell, Tobiah' },
  { id: 3, name: 'Ines Varrow', sort: 'Varrow, Ines' },
  { id: 4, name: 'Oren Halvik', sort: 'Halvik, Oren' },
  { id: 5, name: 'Petra Lunde-Asker', sort: 'Lunde-Asker, Petra' },
  { id: 6, name: 'Callum Vesk', sort: 'Vesk, Callum' },
  { id: 7, name: 'Yusra Pell', sort: 'Pell, Yusra' },
  { id: 8, name: '林霧川', sort: '林霧川' },
  { id: 9, name: 'Wren Adeyo-Holt', sort: 'Adeyo-Holt, Wren' },
  { id: 10, name: 'Soren Ilves', sort: 'Ilves, Soren' },
] as const;

export const SERIES = [
  { id: 1, name: 'Amber Road', first: 2, count: 8, authorId: 2 },
  { id: 2, name: 'Glass Orchard', first: 10, count: 7, authorId: 3 },
  { id: 3, name: 'Northbound', first: 17, count: 20, authorId: 4 },
  { id: 4, name: 'Tidewater Cycle', first: 37, count: 6, authorId: 1 },
] as const;

export const TAGS = [
  { id: 1, name: 'sea' },
  { id: 2, name: 'cities' },
  { id: 3, name: 'memoir' },
  { id: 4, name: 'essays' },
  { id: 5, name: 'maps' },
  { id: 6, name: 'winter' },
  { id: 7, name: 'letters' },
  { id: 8, name: 'craft' },
] as const;

const PUBLISHERS = [
  { id: 1, name: 'Lowtide Press' },
  { id: 2, name: 'Paper Lantern Books' },
] as const;

export const PLATFORMS = [
  { key: 'kobo', name: 'Kobo' },
  { key: 'notebooklm', name: 'NotebookLM' },
  { key: 'readwise-reader', name: 'Readwise Reader' },
] as const;

export const SEED_DELIVERIES = [
  { bookId: 1, platform: 'kobo' },
  { bookId: 2, platform: 'kobo' },
  { bookId: 3, platform: 'kobo' },
  { bookId: 38, platform: 'kobo' },
  { bookId: 1, platform: 'notebooklm' },
  { bookId: 17, platform: 'notebooklm' },
  { bookId: 44, platform: 'readwise-reader' },
] as const;

const SEED_DELIVERED_AT = '2026-09-01T08:30:00.000Z';

const ADJECTIVES = [
  'Amber',
  'Quiet',
  'Salt',
  'Lantern',
  'Copper',
  'Hollow',
  'Winter',
  'Paper',
  'Iron',
  'Silver',
  'Glass',
  'Tidal',
  'Northern',
  'Ember',
  'Harbour',
  'Linen',
  'Cinder',
  'Juniper',
  'Moss',
  'Signal',
];
const NOUNS = [
  'Archive',
  'Crossing',
  'Ledger',
  'Orchard',
  'Lighthouse',
  'Almanac',
  'Atlas',
  'Tidepool',
  'Station',
  'Garden',
  'Weather',
  'Letters',
  'Bridge',
  'Market',
  'River',
  'Choir',
  'Map',
  'Engine',
  'Gate',
  'Season',
];

const OVERRIDES: Record<number, Partial<SeedBook> & { title: string }> = {
  1: {
    title: 'The Salt Archive',
    formats: ['EPUB', 'PDF'],
    rating: 10,
    description:
      '<p>A made-up archive of salt, tides and borrowed letters.</p>',
  },
  44: { title: '霧中的書店', authorIds: [8], language: 'zho' },
  45: { title: '海港來信', authorIds: [8], language: 'zho' },
  46: { title: 'Ledger of Small Winds', formats: ['PDF'] },
  47: { title: 'Two Clocks at Low Water', authorIds: [2, 3] },
  48: { title: 'The Lamplighter’s Year' },
};

const STANDALONE_AUTHORS = [5, 6, 7, 9, 10, 1, 2, 3];

const CALIBRE_DDL = `
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
CREATE TABLE publishers (id INTEGER PRIMARY KEY, name TEXT, sort TEXT);
CREATE TABLE books_publishers_link (id INTEGER PRIMARY KEY, book INTEGER, publisher INTEGER);
CREATE TABLE languages (id INTEGER PRIMARY KEY, lang_code TEXT);
CREATE TABLE books_languages_link (id INTEGER PRIMARY KEY, book INTEGER,
  lang_code INTEGER, item_order INTEGER DEFAULT 0);
CREATE TABLE comments (id INTEGER PRIMARY KEY, book INTEGER, text TEXT);
`;

const APP_DDL = `
CREATE TABLE IF NOT EXISTS delivery_platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS book_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL,
  platform_id INTEGER NOT NULL, added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT, external_ref TEXT,
  FOREIGN KEY (platform_id) REFERENCES delivery_platforms(id));
`;

const pad = (n: number) => String(n).padStart(2, '0');

export function titleSort(title: string): string {
  const match = /^(The|A|An) (.+)$/.exec(title);
  return match ? `${match[2]}, ${match[1]}` : title;
}

function generatedTitle(id: number): string {
  const i = id - 1;
  const base = `The ${ADJECTIVES[i % 20]} ${NOUNS[(7 * i + Math.floor(i / 20)) % 20]}`;
  return id > 70 ? `${base}, Volume ${Math.floor(i / 20) + 1}` : base;
}

function tagsFor(id: number): number[] {
  if (id % 3 === 0) return [(id % 8) + 1, ((id + 3) % 8) + 1];
  if (id % 3 === 1) return [(id % 8) + 1];
  return [];
}

function makeBook(id: number): SeedBook {
  const series =
    id <= 70
      ? SERIES.find((s) => id >= s.first && id < s.first + s.count)
      : undefined;
  const override = OVERRIDES[id];
  const title = override?.title ?? generatedTitle(id);
  return {
    id,
    title,
    sort: titleSort(title),
    authorIds: override?.authorIds ?? [
      series?.authorId ?? STANDALONE_AUTHORS[id % STANDALONE_AUTHORS.length],
    ],
    seriesId: series?.id ?? null,
    seriesIndex: series ? id - series.first + 1 : null,
    tagIds: tagsFor(id),
    formats: override?.formats ?? (id % 5 === 0 ? ['EPUB', 'PDF'] : ['EPUB']),
    pubdate: `${1988 + (id % 37)}-${pad((id % 12) + 1)}-15T00:00:00+00:00`,
    added: `2026-${pad((id % 9) + 1)}-${pad((id % 28) + 1)}T10:00:00+00:00`,
    rating: override?.rating ?? (id % 4 === 0 ? (id % 10) + 1 : null),
    publisherId: id % 2 === 0 ? 1 : 2,
    language: override?.language ?? 'eng',
    description:
      override?.description ??
      (id % 10 === 3
        ? `<p>A made-up book, number ${id} in the fixture library.</p>`
        : null),
  };
}

export function fixtureSize(): FixtureSize {
  return process.env['CALIBRE_FIXTURE'] === 'large' ? 'large' : 'small';
}

export function libraryFor(size: FixtureSize): SeedBook[] {
  const books = Array.from({ length: size === 'large' ? 250 : 70 }, (_, i) =>
    makeBook(i + 1),
  );
  if (new Set(books.map((b) => b.title)).size !== books.length) {
    throw new Error('Fixture titles must be unique');
  }
  return books;
}

export const BOOKS = libraryFor(fixtureSize());

export function bookById(id: number): SeedBook {
  const book = BOOKS.find((b) => b.id === id);
  if (!book) throw new Error(`No fixture book ${id}`);
  return book;
}

export function authorName(id: number): string {
  const author = AUTHORS.find((a) => a.id === id);
  if (!author) throw new Error(`No fixture author ${id}`);
  return author.name;
}

export function tagName(id: number): string {
  const tag = TAGS.find((t) => t.id === id);
  if (!tag) throw new Error(`No fixture tag ${id}`);
  return tag.name;
}

const bookDir = (id: number) => `book-${id}`;

function seedCalibre(books: SeedBook[]): void {
  const db = new Database(METADATA_DB_PATH);
  try {
    db.exec(CALIBRE_DDL);
    const stamp = new Date().toISOString();
    const run = (sql: string, rows: ReadonlyArray<readonly unknown[]>) => {
      const stmt = db.prepare(sql);
      for (const row of rows) stmt.run(...row);
    };
    db.transaction(() => {
      run(
        'INSERT INTO authors (id, name, sort) VALUES (?, ?, ?)',
        AUTHORS.map((a) => [a.id, a.name, a.sort]),
      );
      run(
        'INSERT INTO series (id, name, sort) VALUES (?, ?, ?)',
        SERIES.map((s) => [s.id, s.name, s.name]),
      );
      run(
        'INSERT INTO tags (id, name) VALUES (?, ?)',
        TAGS.map((t) => [t.id, t.name]),
      );
      run(
        'INSERT INTO publishers (id, name, sort) VALUES (?, ?, ?)',
        PUBLISHERS.map((p) => [p.id, p.name, p.name]),
      );
      run('INSERT INTO languages (id, lang_code) VALUES (?, ?)', [
        [1, 'eng'],
        [2, 'zho'],
      ]);
      run(
        'INSERT INTO ratings (id, rating) VALUES (?, ?)',
        Array.from({ length: 10 }, (_, i) => [i + 1, i + 1]),
      );
      run(
        `INSERT INTO books (id, title, sort, timestamp, pubdate, series_index,
           author_sort, path, has_cover, uuid, last_modified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        books.map((b) => [
          b.id,
          b.title,
          b.sort,
          b.added,
          b.pubdate,
          b.seriesIndex,
          b.authorIds
            .map((id) => AUTHORS.find((a) => a.id === id)?.sort ?? '')
            .join(' & '),
          bookDir(b.id),
          `fixture-${b.id}`,
          stamp,
        ]),
      );
      run(
        'INSERT INTO books_authors_link (book, author) VALUES (?, ?)',
        books.flatMap((b) => b.authorIds.map((a) => [b.id, a])),
      );
      run(
        'INSERT INTO books_series_link (book, series) VALUES (?, ?)',
        books.flatMap((b) => (b.seriesId ? [[b.id, b.seriesId]] : [])),
      );
      run(
        'INSERT INTO books_tags_link (book, tag) VALUES (?, ?)',
        books.flatMap((b) => b.tagIds.map((t) => [b.id, t])),
      );
      run(
        'INSERT INTO data (book, format, uncompressed_size, name) VALUES (?, ?, ?, ?)',
        books.flatMap((b) =>
          b.formats.map((f) => [
            b.id,
            f,
            2048 * ((b.id % 7) + 1),
            bookDir(b.id),
          ]),
        ),
      );
      run(
        'INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)',
        books.flatMap((b) => (b.rating ? [[b.id, b.rating]] : [])),
      );
      run(
        'INSERT INTO books_publishers_link (book, publisher) VALUES (?, ?)',
        books.map((b) => [b.id, b.publisherId]),
      );
      run(
        'INSERT INTO books_languages_link (book, lang_code) VALUES (?, ?)',
        books.map((b) => [b.id, b.language === 'zho' ? 2 : 1]),
      );
      run(
        'INSERT INTO comments (book, text) VALUES (?, ?)',
        books.flatMap((b) => (b.description ? [[b.id, b.description]] : [])),
      );
    })();
  } finally {
    db.close();
  }
}

function writeBookFiles(books: SeedBook[]): void {
  for (const book of books) {
    const dir = path.join(FIXTURES_DIR, bookDir(book.id));
    fs.mkdirSync(dir, { recursive: true });
    for (const format of book.formats) {
      fs.writeFileSync(
        path.join(dir, `${bookDir(book.id)}.${format.toLowerCase()}`),
        `made-up ${format} for fixture book ${book.id}\n`,
      );
    }
  }
}

export function resetDeliveries(db: Database.Database): void {
  db.prepare('DELETE FROM book_deliveries').run();
  const insert = db.prepare(
    `INSERT INTO book_deliveries (book_id, platform_id, added_at)
     SELECT ?, id, ? FROM delivery_platforms WHERE key = ?`,
  );
  for (const d of SEED_DELIVERIES) {
    insert.run(d.bookId, SEED_DELIVERED_AT, d.platform);
  }
}

function seedApp(): void {
  const db = new Database(APP_DB_PATH);
  try {
    db.exec(APP_DDL);
    const insert = db.prepare(
      'INSERT OR IGNORE INTO delivery_platforms (key, name) VALUES (?, ?)',
    );
    for (const p of PLATFORMS) insert.run(p.key, p.name);
    resetDeliveries(db);
  } finally {
    db.close();
  }
}

export function seedFixtures(size: FixtureSize): void {
  fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const books = libraryFor(size);
  seedCalibre(books);
  writeBookFiles(books);
  seedApp();
}
