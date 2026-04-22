import Database, { type Database as BetterSqlite3Database } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema';
import * as appSchema from './schema-app';

const sqlite: BetterSqlite3Database = new Database(
  `${process.env.CALIBRE_LIBRARY_PATH}/metadata.db`,
  { readonly: true },
);

export const db = drizzle(sqlite, { schema });

const appDbPath = process.env.CALIBRE_APP_DB_PATH
  ?? `${process.env.CALIBRE_LIBRARY_PATH}/personal-calibre-app.db`;

const appSqlite: BetterSqlite3Database = new Database(appDbPath);

appSqlite.exec(`
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

  UPDATE book_deliveries
  SET added_at = datetime('now')
  WHERE added_at = 'CURRENT_TIMESTAMP';
`);

export const appDb = drizzle(appSqlite, { schema: appSchema });

// Expose the raw sqlite instance for FTS5 queries that Drizzle can't express
export { sqlite };
