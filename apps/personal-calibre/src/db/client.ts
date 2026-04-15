import Database, { type Database as BetterSqlite3Database } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema';

const sqlite: BetterSqlite3Database = new Database(
  `${process.env.CALIBRE_LIBRARY_PATH}/metadata.db`,
  { readonly: true },
);

export const db = drizzle(sqlite, { schema });

// Expose the raw sqlite instance for FTS5 queries that Drizzle can't express
export { sqlite };
