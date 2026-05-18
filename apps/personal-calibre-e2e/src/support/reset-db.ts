import Database from 'better-sqlite3';
import path from 'path';

// Clears all delivery records between tests. Safe to call even if app.db doesn't exist yet.
export function resetAppDb() {
  const appDbPath = path.join(__dirname, '../fixtures/app.db');
  try {
    const db = new Database(appDbPath);
    db.prepare(`DELETE FROM book_deliveries`).run();
    db.close();
  } catch {
    // DB may not exist yet if no request has been made — that's fine.
  }
}
