import fs from 'node:fs';

import Database from 'better-sqlite3';

import { APP_DB_PATH, resetDeliveries } from './seed';

export function resetAppDb(): void {
  if (!fs.existsSync(APP_DB_PATH)) return;
  const db = new Database(APP_DB_PATH);
  try {
    resetDeliveries(db);
  } finally {
    db.close();
  }
}
