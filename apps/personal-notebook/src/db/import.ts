import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';

import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import Database from 'better-sqlite3';

import { pagesDir, searchDir } from './paths';

/** Where personal-calibre kept notebooks before they moved here, relative to its data folder. */
export const CALIBRE_LAYOUT = {
  db: 'personal-calibre-app.db',
  pages: 'notebooks',
  index: path.join('search', 'notebook-pages'),
} as const;

const TABLES = ['notebooks', 'notebook_pages'] as const;

const columnsOf = (sqlite: BetterSqlite3Database, table: string): string[] =>
  (
    sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>
  ).map((column) => column.name);

export interface ImportResult {
  notebooks: number;
  pages: number;
  transcribed: number;
}

/**
 * Copies the notebooks personal-calibre held into an empty notebook DB: both tables with their
 * ids, the page images and the page search index. It runs once, on the first open of a DB with no
 * notebooks, and does nothing when `from` holds none, so the variable can stay set after the move.
 * The source is only read.
 */
export function importFromCalibre(
  target: BetterSqlite3Database,
  from: string,
  dataDir: string,
  log: (line: string) => void = console.log,
): ImportResult | null {
  const hasAny = target.prepare('SELECT 1 FROM notebooks LIMIT 1').get();
  if (hasAny) return null;
  // `from` is a mounted volume, never a build input; the ignores keep Turbopack from tracing the
  // whole project into the server output.
  const source = path.join(/*turbopackIgnore: true*/ from, CALIBRE_LAYOUT.db);
  if (!existsSync(source)) {
    log(`notebook import: ${source} not found, nothing imported`);
    return null;
  }
  const legacy = new Database(source, { readonly: true, fileMustExist: true });
  try {
    const present = new Set(
      (
        legacy
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as Array<{ name: string }>
      ).map((row) => row.name),
    );
    if (!TABLES.every((table) => present.has(table))) return null;
    const count = (sql: string) =>
      (legacy.prepare(sql).get() as { n: number }).n;
    if (count('SELECT count(*) AS n FROM notebooks') === 0) return null;

    // Images first: a crash after this leaves the DB empty, so the next start copies again.
    const pages = path.join(
      /*turbopackIgnore: true*/ from,
      CALIBRE_LAYOUT.pages,
    );
    if (existsSync(pages))
      cpSync(pages, pagesDir(dataDir), { recursive: true });
    const index = path.join(
      /*turbopackIgnore: true*/ from,
      CALIBRE_LAYOUT.index,
    );
    if (existsSync(index))
      cpSync(index, path.join(searchDir(dataDir), 'notebook-pages'), {
        recursive: true,
      });

    target.transaction(() => {
      for (const table of TABLES) {
        const wanted = new Set(columnsOf(target, table));
        const shared = columnsOf(legacy, table).filter((c) => wanted.has(c));
        const list = shared.join(', ');
        const insert = target.prepare(
          `INSERT INTO ${table} (${list}) VALUES (${shared.map(() => '?').join(', ')})`,
        );
        for (const row of legacy
          .prepare(`SELECT ${list} FROM ${table} ORDER BY id`)
          .raw()
          .iterate())
          insert.run(row as unknown[]);
      }
    })();

    const result = {
      notebooks: count('SELECT count(*) AS n FROM notebooks'),
      pages: count('SELECT count(*) AS n FROM notebook_pages'),
      transcribed: count(
        'SELECT count(*) AS n FROM notebook_pages WHERE transcription IS NOT NULL',
      ),
    };
    log(
      `notebook import: copied ${result.notebooks} notebooks, ${result.pages} pages (${result.transcribed} transcribed) from ${from}`,
    );
    return result;
  } finally {
    legacy.close();
  }
}
