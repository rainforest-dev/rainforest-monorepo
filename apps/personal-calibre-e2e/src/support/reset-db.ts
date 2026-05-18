import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Clears all delivery records between tests. Safe to call even if app.db doesn't exist yet.
export function resetAppDb() {
  const appDbPath = path.join(__dirname, '../fixtures/app.db');
  if (!fs.existsSync(appDbPath)) return;
  const db = new Database(appDbPath);
  try {
    db.prepare(`DELETE FROM book_deliveries`).run();
  } finally {
    db.close();
  }
}
