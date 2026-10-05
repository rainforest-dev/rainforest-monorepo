import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  acquireIngestLock,
  IngestLockHeld,
  LOCK_FILE,
  withIngestLock,
} from './lock.ts';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'memories-lock-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const lockPath = () => join(root, LOCK_FILE);
const holder = () => JSON.parse(readFileSync(lockPath(), 'utf8'));

describe('acquireIngestLock', () => {
  it('creates the lock with its pid and removes it on release', () => {
    const lock = acquireIngestLock(root, { pid: 4242 });
    expect(holder()).toMatchObject({ pid: 4242 });
    lock.release();
    expect(existsSync(lockPath())).toBe(false);
  });

  it('refuses while a live process holds it, naming the pid and the file', () => {
    acquireIngestLock(root, { pid: 111 });
    const attempt = () =>
      acquireIngestLock(root, { pid: 222, isAlive: () => true });
    expect(attempt).toThrow(IngestLockHeld);
    expect(attempt).toThrow(/pid 111.*delete .*\.ingest\.lock/);
    expect(holder().pid).toBe(111);
  });

  it('takes over a lock whose pid is dead', () => {
    acquireIngestLock(root, { pid: 111 });
    const lock = acquireIngestLock(root, {
      pid: 222,
      isAlive: (pid) => pid !== 111,
    });
    expect(holder().pid).toBe(222);
    lock.release();
    expect(existsSync(lockPath())).toBe(false);
  });

  it('treats a fresh unreadable lock as held and an old one as stale', () => {
    writeFileSync(lockPath(), '');
    expect(() => acquireIngestLock(root, { pid: 1 })).toThrow(IngestLockHeld);

    const old = (Date.now() - 120_000) / 1000;
    utimesSync(lockPath(), old, old);
    acquireIngestLock(root, { pid: 1 }).release();
    expect(existsSync(lockPath())).toBe(false);
  });

  it('leaves a lock alone on release once another process owns it', () => {
    const lock = acquireIngestLock(root, { pid: 111 });
    writeFileSync(lockPath(), JSON.stringify({ pid: 333, startedAt: 'x' }));
    lock.release();
    expect(holder().pid).toBe(333);
  });
});

describe('withIngestLock', () => {
  it('releases the lock when the run throws', async () => {
    await expect(
      withIngestLock(root, () => {
        expect(existsSync(lockPath())).toBe(true);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(existsSync(lockPath())).toBe(false);
  });

  it('does not run when the lock is held', async () => {
    acquireIngestLock(root, { pid: process.pid });
    let ran = false;
    await expect(
      withIngestLock(root, () => {
        ran = true;
      }),
    ).rejects.toThrow(IngestLockHeld);
    expect(ran).toBe(false);
  });
});
