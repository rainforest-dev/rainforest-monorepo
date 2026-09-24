import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createNotesStore, UnreadableNoteError } from './store.ts';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'notes-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const EDIT = { body: '下雨', annotations: [] };

describe('NotesStore', () => {
  it('reads a missing day as empty with version ""', () => {
    const { note, version } = createNotesStore(root).read('2025-11-01');
    expect(version).toBe('');
    expect(note.body).toBe('');
  });

  it('creates, then updates with the returned version', () => {
    const store = createNotesStore(root);
    const first = store.write('2025-11-01', EDIT, '');
    expect(first.ok).toBe(true);
    const path = join(root, '2025', '2025-11-01.md');
    expect(readFileSync(path, 'utf8')).toContain('下雨');

    const v1 = (first as { version: string }).version;
    const second = store.write('2025-11-01', { ...EDIT, body: '放晴' }, v1);
    expect(second.ok).toBe(true);
    expect(store.read('2025-11-01').note.body).toBe('放晴');
    expect(store.dates()).toEqual(new Set(['2025-11-01']));
  });

  it('refuses a stale version and returns the file', () => {
    const store = createNotesStore(root);
    store.write('2025-11-01', EDIT, '');
    const path = join(root, '2025', '2025-11-01.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace('下雨', 'Obsidian 改的'),
    );

    const result = store.write(
      '2025-11-01',
      { ...EDIT, body: 'app 改的' },
      'stale',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.current.note.body).toBe('Obsidian 改的');
  });

  it('keeps frontmatter keys added in Obsidian', () => {
    const store = createNotesStore(root);
    const created = store.write('2025-11-01', EDIT, '');
    const path = join(root, '2025', '2025-11-01.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace('tags:', 'mood: calm\ntags:'),
    );
    const { version } = store.read('2025-11-01');
    expect(version).not.toBe((created as { version: string }).version);
    store.write('2025-11-01', { ...EDIT, body: '改' }, version);
    expect(readFileSync(path, 'utf8')).toContain('mood: calm');
  });

  it('deletes the file when everything is emptied', () => {
    const store = createNotesStore(root);
    const created = store.write('2025-11-01', EDIT, '');
    const result = store.write(
      '2025-11-01',
      { body: '', annotations: [] },
      (created as { version: string }).version,
    );
    expect(result).toEqual({ ok: true, version: '' });
    expect(existsSync(join(root, '2025', '2025-11-01.md'))).toBe(false);
  });

  it('deletes an emptied file whose tags are only memories', () => {
    const store = createNotesStore(root);
    const path = join(root, '2025', '2025-11-01.md');
    store.write('2025-11-01', { ...EDIT, cover: 'X' }, '');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        'tags:\n  - memories',
        'tags: memories',
      ),
    );
    const { version } = store.read('2025-11-01');
    expect(
      store.write('2025-11-01', { body: '', annotations: [] }, version),
    ).toEqual({
      ok: true,
      version: '',
    });
    expect(existsSync(path)).toBe(false);
  });

  it('keeps a frontmatter-only file when user keys remain', () => {
    const store = createNotesStore(root);
    const path = join(root, '2025', '2025-11-01.md');
    store.write('2025-11-01', { ...EDIT, cover: 'X' }, '');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace('tags:', 'mood: good\ntags:'),
    );
    const { version } = store.read('2025-11-01');
    const result = store.write(
      '2025-11-01',
      { body: '', annotations: [] },
      version,
    );
    expect(result.ok).toBe(true);
    const text = readFileSync(path, 'utf8');
    expect(text).toContain('mood: good');
    expect(text).not.toContain('下雨');
    expect(text).not.toContain('cover:');
    expect(store.read('2025-11-01').version).toBe(
      (result as { version: string }).version,
    );
  });

  it('reads malformed frontmatter as a read-only empty day and never writes it', () => {
    const store = createNotesStore(root);
    const path = join(root, '2025', '2025-11-01.md');
    store.write('2025-11-01', EDIT, '');
    const broken = '---\nmood: [good\n---\n\n手寫的\n';
    writeFileSync(path, broken);

    const read = store.read('2025-11-01');
    expect(read.parseError).toBe(true);
    expect(read.note.body).toBe('');
    expect(() =>
      store.write('2025-11-01', { ...EDIT, body: '覆蓋' }, read.version),
    ).toThrow(UnreadableNoteError);
    expect(() =>
      store.write('2025-11-01', { body: '', annotations: [] }, read.version),
    ).toThrow(UnreadableNoteError);
    expect(readFileSync(path, 'utf8')).toBe(broken);
  });

  it('rejects malformed dates', () => {
    expect(() => createNotesStore(root).read('../../etc/passwd')).toThrow(
      'invalid date',
    );
  });
});
