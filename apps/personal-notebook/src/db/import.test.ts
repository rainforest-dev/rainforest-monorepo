import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { NOTEBOOKS_DDL } from './ddl';
import { CALIBRE_LAYOUT, importFromCalibre } from './import';

const tmp = (prefix: string) =>
  mkdtempSync(path.join(os.tmpdir(), `notebook-import-${prefix}-`));

/** A calibre data folder as it was before the move: two notebooks, three pages, one read. */
function calibreFolder(): string {
  const from = tmp('calibre');
  const legacy = new Database(path.join(from, CALIBRE_LAYOUT.db));
  legacy.exec(NOTEBOOKS_DDL);
  // Calibre's own tables sit in the same file; the import ignores them.
  legacy.exec('CREATE TABLE book_tags (book_id INTEGER, tag_id INTEGER)');
  legacy.exec(`
    INSERT INTO notebooks (id, name, status, started_on) VALUES
      (3, 'Spring Log', 'archived', '2026-03-01'),
      (7, 'Summer Log', 'active', NULL);
    INSERT INTO notebook_pages
      (id, notebook_id, position, file_name, mime_type, bytes, content_hash, transcription, ocr_attempts)
    VALUES
      (11, 3, 1, 'a.jpg', 'image/jpeg', 3, 'h1', '- [ ] buy ink', 1),
      (12, 3, 2, 'b.jpg', 'image/jpeg', 3, 'h2', NULL, 0),
      (20, 7, 1, 'c.jpg', 'image/jpeg', 3, 'h3', NULL, 2);
  `);
  legacy.close();
  for (const [notebook, page] of [
    [3, 11],
    [3, 12],
    [7, 20],
  ]) {
    const dir = path.join(from, CALIBRE_LAYOUT.pages, String(notebook));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${page}.jpg`), `p${page}`);
  }
  const index = path.join(from, CALIBRE_LAYOUT.index);
  mkdirSync(index, { recursive: true });
  writeFileSync(path.join(index, 'lexical.json'), '{"docs":3}');
  return from;
}

function emptyTarget() {
  const dataDir = tmp('target');
  const target = new Database(path.join(dataDir, 'notebook.db'));
  target.exec(NOTEBOOKS_DDL);
  return { dataDir, target };
}

describe('importFromCalibre', () => {
  it('copies rows with their ids, the page images and the index, and reports the counts', () => {
    const from = calibreFolder();
    const { dataDir, target } = emptyTarget();
    const lines: string[] = [];

    const result = importFromCalibre(target, from, dataDir, (line) =>
      lines.push(line),
    );

    expect(result).toEqual({ notebooks: 2, pages: 3, transcribed: 1 });
    expect(
      target
        .prepare('SELECT id, name, status FROM notebooks ORDER BY id')
        .all(),
    ).toEqual([
      { id: 3, name: 'Spring Log', status: 'archived' },
      { id: 7, name: 'Summer Log', status: 'active' },
    ]);
    expect(
      target
        .prepare(
          'SELECT id, notebook_id, transcription, ocr_attempts FROM notebook_pages ORDER BY id',
        )
        .all(),
    ).toEqual([
      {
        id: 11,
        notebook_id: 3,
        transcription: '- [ ] buy ink',
        ocr_attempts: 1,
      },
      { id: 12, notebook_id: 3, transcription: null, ocr_attempts: 0 },
      { id: 20, notebook_id: 7, transcription: null, ocr_attempts: 2 },
    ]);
    expect(
      readFileSync(path.join(dataDir, 'pages', '7', '20.jpg'), 'utf8'),
    ).toBe('p20');
    expect(
      readFileSync(
        path.join(dataDir, 'search', 'notebook-pages', 'lexical.json'),
        'utf8',
      ),
    ).toBe('{"docs":3}');
    expect(lines).toEqual([
      `notebook import: copied 2 notebooks, 3 pages (1 transcribed) from ${from}`,
    ]);

    // New rows continue after the imported ids.
    target.prepare("INSERT INTO notebooks (name) VALUES ('Autumn Log')").run();
    expect(
      target
        .prepare("SELECT id FROM notebooks WHERE name = 'Autumn Log'")
        .get(),
    ).toEqual({ id: 8 });
  });

  it('leaves the source as it was', () => {
    const from = calibreFolder();
    const { dataDir, target } = emptyTarget();
    importFromCalibre(target, from, dataDir, () => undefined);
    const legacy = new Database(path.join(from, CALIBRE_LAYOUT.db), {
      readonly: true,
    });
    expect(legacy.prepare('SELECT count(*) AS n FROM notebooks').get()).toEqual(
      { n: 2 },
    );
    legacy.close();
    expect(
      existsSync(path.join(from, CALIBRE_LAYOUT.pages, '3', '11.jpg')),
    ).toBe(true);
  });

  it('does nothing once the target has notebooks, so the setting can stay', () => {
    const from = calibreFolder();
    const { dataDir, target } = emptyTarget();
    importFromCalibre(target, from, dataDir, () => undefined);
    target.prepare("UPDATE notebooks SET name = 'Renamed' WHERE id = 3").run();

    expect(
      importFromCalibre(target, from, dataDir, () => undefined),
    ).toBeNull();
    expect(
      target.prepare('SELECT name FROM notebooks WHERE id = 3').get(),
    ).toEqual({ name: 'Renamed' });
  });

  it('does nothing when the folder has no calibre DB or no notebooks', () => {
    const { dataDir, target } = emptyTarget();
    const lines: string[] = [];
    expect(
      importFromCalibre(target, tmp('missing'), dataDir, (l) => lines.push(l)),
    ).toBeNull();
    expect(lines[0]).toMatch(/not found, nothing imported/);

    const bare = tmp('bare');
    new Database(path.join(bare, CALIBRE_LAYOUT.db))
      .exec('CREATE TABLE books (id INTEGER)')
      .close();
    expect(
      importFromCalibre(target, bare, dataDir, () => undefined),
    ).toBeNull();

    const empty = tmp('empty');
    new Database(path.join(empty, CALIBRE_LAYOUT.db))
      .exec(NOTEBOOKS_DDL)
      .close();
    expect(
      importFromCalibre(target, empty, dataDir, () => undefined),
    ).toBeNull();
    expect(target.prepare('SELECT count(*) AS n FROM notebooks').get()).toEqual(
      { n: 0 },
    );
  });
});
