import Database from "better-sqlite3";
import type { Database as BetterSqlite3Database } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";
import * as appSchema from "./schema-app";

type CalibreDb = ReturnType<typeof drizzle<typeof schema>>;
type AppDb = ReturnType<typeof drizzle<typeof appSchema>>;

let _calibreDb: CalibreDb | null = null;
let _appDb: AppDb | null = null;
let _rawSqlite: BetterSqlite3Database | null = null;
let _appSqlite: BetterSqlite3Database | null = null;

function getCalibreDb(): CalibreDb {
  if (!_calibreDb) {
    const libraryPath = process.env.CALIBRE_LIBRARY_PATH;
    if (!libraryPath) throw new Error("CALIBRE_LIBRARY_PATH is not set");
    _rawSqlite = new Database(`${libraryPath}/metadata.db`, { readonly: true });
    _calibreDb = drizzle(_rawSqlite, { schema });
  }
  return _calibreDb;
}

type BookFtsRow = { id: number; title: string; authors: string; series: string };

// Syncs books_fts in the app DB from the Calibre DB. Runs once per process;
// skips rebuild if the Calibre DB's newest last_modified hasn't changed.
function syncBooksFts(): void {
  _appSqlite!.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
      id        UNINDEXED,
      title,
      authors,
      series,
      tokenize = "trigram"
    );
    CREATE TABLE IF NOT EXISTS books_fts_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const calibreStamp = (
    _rawSqlite!
      .prepare("SELECT max(last_modified) AS ts FROM books")
      .get() as { ts: string | null }
  ).ts ?? "";

  const stored = (
    _appSqlite!
      .prepare("SELECT value FROM books_fts_meta WHERE key = 'last_modified'")
      .get() as { value: string } | undefined
  )?.value;

  if (stored === calibreStamp) return;

  const rows = _rawSqlite!
    .prepare(
      `SELECT b.id, b.title,
              COALESCE(group_concat(a.name, ', '), b.author_sort, '') AS authors,
              COALESCE(s.name, '')                                    AS series
       FROM books b
       LEFT JOIN books_authors_link bal ON bal.book = b.id
       LEFT JOIN authors a              ON a.id     = bal.author
       LEFT JOIN books_series_link  bsl ON bsl.book = b.id
       LEFT JOIN series s               ON s.id     = bsl.series
       GROUP BY b.id`,
    )
    .all() as BookFtsRow[];

  const ins = _appSqlite!.prepare(
    "INSERT INTO books_fts (id, title, authors, series) VALUES (?, ?, ?, ?)",
  );

  _appSqlite!.transaction(() => {
    _appSqlite!.prepare("DELETE FROM books_fts").run();
    for (const row of rows) {
      ins.run(row.id, row.title, row.authors ?? "", row.series ?? "");
    }
    _appSqlite!
      .prepare(
        "INSERT OR REPLACE INTO books_fts_meta (key, value) VALUES ('last_modified', ?)",
      )
      .run(calibreStamp);
  })();
}

function getAppDb(): AppDb {
  if (!_appDb) {
    // Ensure Calibre DB is open so _rawSqlite is available for FTS sync.
    getCalibreDb();

    const libraryPath = process.env.CALIBRE_LIBRARY_PATH;
    if (!libraryPath) throw new Error("CALIBRE_LIBRARY_PATH is not set");
    const appDbPath =
      process.env.CALIBRE_APP_DB_PATH ?? `${libraryPath}/personal-calibre-app.db`;

    _appSqlite = new Database(appDbPath);
    _appSqlite.exec(`
      CREATE TABLE IF NOT EXISTS delivery_platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS book_deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        platform_id INTEGER NOT NULL,
        added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        note TEXT,
        external_ref TEXT,
        FOREIGN KEY (platform_id) REFERENCES delivery_platforms(id)
      );
      CREATE INDEX IF NOT EXISTS idx_book_deliveries_book_id ON book_deliveries(book_id);
      CREATE INDEX IF NOT EXISTS idx_book_deliveries_platform_id ON book_deliveries(platform_id);
      INSERT OR IGNORE INTO delivery_platforms (key, name) VALUES
        ('readwise-reader', 'Readwise Reader'),
        ('notebooklm', 'NotebookLM');
      UPDATE book_deliveries SET added_at = datetime('now') WHERE added_at = 'CURRENT_TIMESTAMP';
    `);

    syncBooksFts();

    _appDb = drizzle(_appSqlite, { schema: appSchema });
  }
  return _appDb;
}

// Proxies defer DB init until first property access at request time,
// preventing next build from throwing when CALIBRE_LIBRARY_PATH is unset.
export const db = new Proxy({} as CalibreDb, {
  get(_, prop) {
    const d = getCalibreDb();
    const val = d[prop as keyof CalibreDb];
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(d) : val;
  },
});

export const appDb = new Proxy({} as AppDb, {
  get(_, prop) {
    const d = getAppDb();
    const val = d[prop as keyof AppDb];
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(d) : val;
  },
});

// Raw Calibre sqlite — for FTS5 queries Drizzle cannot express.
export const sqlite: BetterSqlite3Database = new Proxy({} as BetterSqlite3Database, {
  get(_, prop) {
    getCalibreDb();
    const val = _rawSqlite![prop as keyof BetterSqlite3Database];
    return typeof val === "function"
      ? (val as (...args: unknown[]) => unknown).bind(_rawSqlite)
      : val;
  },
});

// Raw app sqlite — for querying the books_fts FTS5 table.
export const appSqlite: BetterSqlite3Database = new Proxy({} as BetterSqlite3Database, {
  get(_, prop) {
    getAppDb();
    const val = _appSqlite![prop as keyof BetterSqlite3Database];
    return typeof val === "function"
      ? (val as (...args: unknown[]) => unknown).bind(_appSqlite)
      : val;
  },
});
