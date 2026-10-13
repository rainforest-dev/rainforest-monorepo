// Bullet Journal notebooks and their scanned pages. Page images live on disk under the
// notebooks directory; a page row holds the metadata and the transcription.
export const NOTEBOOKS_DDL = `
  CREATE TABLE IF NOT EXISTS notebooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    started_on TEXT,
    ended_on TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS notebook_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notebook_id INTEGER NOT NULL REFERENCES notebooks(id),
    position INTEGER NOT NULL,
    page_number INTEGER,
    page_date TEXT,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    transcription TEXT,
    transcribed_at TEXT,
    source TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (notebook_id, content_hash)
  );
  CREATE INDEX IF NOT EXISTS idx_notebook_pages_notebook_position
    ON notebook_pages(notebook_id, position);
`;
