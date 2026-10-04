import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  type InboxListing,
  moveToRejected,
  planInbox,
  SETTLE_MS,
} from './drop-folder.ts';

const NOW = Date.parse('2025-11-20T10:00:00Z');
const old = NOW - 60_000;
const file = (
  name: string,
  extra: Partial<InboxListing> = {},
): InboxListing => ({
  name,
  isFile: true,
  mtimeMs: old,
  dataless: false,
  ...extra,
});

describe('planInbox', () => {
  it('sorts each entry into ready, placeholder, settling or reject', () => {
    const plan = planInbox(
      '/inbox',
      [
        file('b.txt'),
        file('.a.txt.icloud'),
        file('c.txt', { dataless: true }),
        file('d.txt', { mtimeMs: NOW - SETTLE_MS + 1 }),
        file('e.zip'),
        file('folder', { isFile: false }),
        file('.DS_Store'),
        file('rejected', { isFile: false }),
      ],
      NOW,
    );
    expect(plan).toEqual([
      {
        kind: 'placeholder',
        name: '.a.txt.icloud',
        path: '/inbox/.a.txt.icloud',
        download: '/inbox/a.txt',
      },
      { kind: 'ready', name: 'b.txt', path: '/inbox/b.txt' },
      {
        kind: 'placeholder',
        name: 'c.txt',
        path: '/inbox/c.txt',
        download: '/inbox/c.txt',
      },
      { kind: 'settling', name: 'd.txt', path: '/inbox/d.txt' },
      {
        kind: 'reject',
        name: 'e.zip',
        path: '/inbox/e.zip',
        reason: 'not a .txt file',
      },
      {
        kind: 'reject',
        name: 'folder',
        path: '/inbox/folder',
        reason: 'not a file',
      },
    ]);
  });

  it('treats a file with a future mtime as still settling', () => {
    expect(
      planInbox('/inbox', [file('a.txt', { mtimeMs: NOW + 5_000 })], NOW),
    ).toEqual([{ kind: 'settling', name: 'a.txt', path: '/inbox/a.txt' }]);
  });
});

describe('moveToRejected', () => {
  it('writes the reason beside the file and never overwrites an earlier reject', () => {
    const dir = mkdtempSync(join(tmpdir(), 'memories-drop-'));
    try {
      writeFileSync(join(dir, 'x.txt'), 'one');
      moveToRejected(
        dir,
        join(dir, 'x.txt'),
        'x.txt',
        'no messages',
        'aaaa1111',
      );
      writeFileSync(join(dir, 'x.txt'), 'two');
      const second = moveToRejected(
        dir,
        join(dir, 'x.txt'),
        'x.txt',
        'no messages',
        'bbbb2222',
      );
      expect(second).toBe(join(dir, 'rejected', 'x-bbbb2222.txt'));
      expect(readFileSync(join(dir, 'rejected', 'x.txt'), 'utf8')).toBe('one');
      expect(readFileSync(`${second}.reason.txt`, 'utf8')).toBe(
        'no messages\n',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
