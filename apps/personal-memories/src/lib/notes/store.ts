import { createHash } from 'node:crypto';
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { emptyNote, isEmptyNote, parseNote, serializeNote } from './format.ts';
import type { DayNote } from './types.ts';

export type NoteVersion = string;
export type NoteEdit = Pick<DayNote, 'body' | 'annotations' | 'cover'>;
export type ReadResult = { note: DayNote; version: NoteVersion };
export type WriteResult =
  { ok: true; version: NoteVersion } | { ok: false; current: ReadResult };
export type NotesStore = {
  readonly root: string;
  readonly writable: boolean;
  read(date: string): ReadResult;
  write(date: string, edit: NoteEdit, expected: NoteVersion): WriteResult;
  dates(): Set<string>;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FILE = /^(\d{4}-\d{2}-\d{2})\.md$/;

const versionOf = (text: string) =>
  createHash('sha256').update(text).digest('hex').slice(0, 16);

function isWritable(root: string) {
  try {
    accessSync(root, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function createNotesStore(root: string): NotesStore {
  const pathOf = (date: string) => {
    if (!DATE.test(date)) throw new Error('invalid date');
    return join(root, date.slice(0, 4), `${date}.md`);
  };

  const read = (date: string): ReadResult => {
    const path = pathOf(date);
    if (!existsSync(path)) return { note: emptyNote(date), version: '' };
    const text = readFileSync(path, 'utf8');
    return { note: parseNote(text, date), version: versionOf(text) };
  };

  return {
    root,
    writable: isWritable(root),
    read,
    write(date, edit, expected) {
      const current = read(date);
      if (current.version !== expected) return { ok: false, current };
      const path = pathOf(date);
      const next: DayNote = { ...current.note, ...edit, date };
      if (!edit.cover) delete next.cover;
      if (isEmptyNote(next)) {
        rmSync(path, { force: true });
        return { ok: true, version: '' };
      }
      const text = serializeNote(next);
      mkdirSync(join(root, date.slice(0, 4)), { recursive: true });
      writeFileSync(`${path}.tmp`, text);
      renameSync(`${path}.tmp`, path);
      return { ok: true, version: versionOf(text) };
    },
    dates() {
      const out = new Set<string>();
      if (!existsSync(root)) return out;
      for (const year of readdirSync(root)) {
        if (!/^\d{4}$/.test(year)) continue;
        for (const file of readdirSync(join(root, year))) {
          const match = FILE.exec(file);
          if (match) out.add(match[1]);
        }
      }
      return out;
    },
  };
}

let cached: NotesStore | undefined;

export function notesStore(): NotesStore | undefined {
  const root = process.env['MEMORIES_NOTES_DIR'];
  if (!root || !existsSync(root)) return undefined;
  if (cached?.root !== root) cached = createNotesStore(root);
  return cached;
}
