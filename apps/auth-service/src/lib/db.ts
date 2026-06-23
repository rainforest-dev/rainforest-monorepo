import Database from 'better-sqlite3';

export type StoredCredential = {
  id: string;
  publicKey: string;
  counter: number;
  transports: string[];
};

let _db: ReturnType<typeof Database> | null = null;

function getDb(): ReturnType<typeof Database> {
  if (_db) return _db;
  const path = process.env.AUTH_DB_PATH ?? '/app/db/auth.db';
  _db = new Database(path);
  _db.prepare(`
    CREATE TABLE IF NOT EXISTS credentials (
      id          TEXT PRIMARY KEY,
      public_key  TEXT NOT NULL,
      counter     INTEGER NOT NULL DEFAULT 0,
      transports  TEXT NOT NULL DEFAULT '[]',
      created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();
  return _db;
}

export function saveCredential(cred: StoredCredential): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO credentials (id, public_key, counter, transports)
       VALUES (?, ?, ?, ?)`,
    )
    .run(cred.id, cred.publicKey, cred.counter, JSON.stringify(cred.transports));
}

export function getCredential(id: string): StoredCredential | null {
  const row = getDb()
    .prepare('SELECT * FROM credentials WHERE id = ?')
    .get(id) as
    | { id: string; public_key: string; counter: number; transports: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: JSON.parse(row.transports) as string[],
  };
}

export function listCredentials(): StoredCredential[] {
  const rows = getDb()
    .prepare('SELECT * FROM credentials ORDER BY created_at ASC')
    .all() as { id: string; public_key: string; counter: number; transports: string }[];
  return rows.map((r) => ({
    id: r.id,
    publicKey: r.public_key,
    counter: r.counter,
    transports: JSON.parse(r.transports) as string[],
  }));
}

export function updateCounter(id: string, counter: number): void {
  getDb().prepare('UPDATE credentials SET counter = ? WHERE id = ?').run(counter, id);
}
