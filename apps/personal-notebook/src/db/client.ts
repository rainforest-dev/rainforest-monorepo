import { mkdirSync } from 'node:fs';
import path from 'node:path';

import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import {
  NOTEBOOK_ADDED_COLUMNS,
  NOTEBOOK_PAGE_ADDED_COLUMNS,
  NOTEBOOKS_DDL,
} from './ddl';
import { importFromCalibre } from './import';
import * as schema from './schema';

type NotebookDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: NotebookDb | null = null;
let _sqlite: BetterSqlite3Database | null = null;

/**
 * Everything the app writes lives under `NOTEBOOK_DATA_DIR`: the DB, the page images and the
 * search index. Production mounts a volume there.
 */
export function dataDir(): string {
  const dir = process.env.NOTEBOOK_DATA_DIR;
  if (!dir) throw new Error('NOTEBOOK_DATA_DIR is not set');
  return dir;
}

export const dbPath = (): string => path.join(dataDir(), 'notebook.db');

/** Adds columns a table created by an older build does not have yet. */
function addMissingColumns(
  sqliteDb: BetterSqlite3Database,
  table: string,
  added: readonly { name: string; definition: string }[],
): void {
  const columns = new Set(
    (
      sqliteDb.prepare(`PRAGMA table_info(${table})`).all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );
  for (const { name, definition } of added) {
    if (!columns.has(name)) {
      sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    }
  }
}

/** Opens the DB, creating and migrating it on first use. */
export function openDb(): NotebookDb {
  if (!_db) {
    mkdirSync(dataDir(), { recursive: true });
    _sqlite = new Database(dbPath());
    _sqlite.exec(NOTEBOOKS_DDL);
    addMissingColumns(_sqlite, 'notebooks', NOTEBOOK_ADDED_COLUMNS);
    addMissingColumns(_sqlite, 'notebook_pages', NOTEBOOK_PAGE_ADDED_COLUMNS);
    const from = process.env.NOTEBOOK_IMPORT_FROM;
    if (from) importFromCalibre(_sqlite, from, dataDir());
    _db = drizzle(_sqlite, { schema });
  }
  return _db;
}

// Defers opening the DB to the first query at request time, so `next build` does not need
// NOTEBOOK_DATA_DIR.
export const db = new Proxy({} as NotebookDb, {
  get(_, prop) {
    const d = openDb();
    const val = d[prop as keyof NotebookDb];
    return typeof val === 'function'
      ? (val as (...args: unknown[]) => unknown).bind(d)
      : val;
  },
});
