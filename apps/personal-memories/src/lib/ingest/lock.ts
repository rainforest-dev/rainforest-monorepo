import {
  closeSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';

export const LOCK_FILE = '.ingest.lock';

const UNREADABLE_GRACE_MS = 60_000;

export type LockHolder = { pid?: number; startedAt?: string };

export class IngestLockHeld extends Error {
  readonly path: string;
  readonly holder: LockHolder;

  constructor(path: string, holder: LockHolder) {
    super(
      `another ingest is running (pid ${holder.pid ?? 'unknown'}` +
        `${holder.startedAt ? `, since ${holder.startedAt}` : ''}). ` +
        `If none is, delete ${path} and run again.`,
    );
    this.name = 'IngestLockHeld';
    this.path = path;
    this.holder = holder;
  }
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

const readHolder = (path: string): LockHolder | undefined => {
  try {
    const holder = JSON.parse(readFileSync(path, 'utf8')) as LockHolder;
    return typeof holder.pid === 'number' ? holder : undefined;
  } catch {
    return undefined;
  }
};

export type IngestLock = { path: string; release: () => void };

export type LockOptions = {
  pid?: number;
  now?: () => number;
  isAlive?: (pid: number) => boolean;
};

export function acquireIngestLock(
  root: string,
  { pid = process.pid, now = Date.now, isAlive = pidAlive }: LockOptions = {},
): IngestLock {
  const path = join(root, LOCK_FILE);
  const startedAt = new Date(now()).toISOString();

  for (let attempt = 0; attempt < 2; attempt++) {
    let fd: number;
    try {
      fd = openSync(path, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const holder = readHolder(path);
      if (holder?.pid !== undefined && isAlive(holder.pid))
        throw new IngestLockHeld(path, holder);
      if (!holder && now() - statSync(path).mtimeMs < UNREADABLE_GRACE_MS)
        throw new IngestLockHeld(path, {});
      rmSync(path, { force: true });
      continue;
    }
    try {
      writeSync(fd, JSON.stringify({ pid, startedAt }));
    } finally {
      closeSync(fd);
    }
    return {
      path,
      release: () => {
        const holder = readHolder(path);
        if (holder?.pid === pid && holder.startedAt === startedAt)
          rmSync(path, { force: true });
      },
    };
  }
  throw new IngestLockHeld(path, readHolder(path) ?? {});
}

export async function withIngestLock<T>(
  root: string,
  run: () => T | Promise<T>,
  options?: LockOptions,
): Promise<T> {
  const lock = acquireIngestLock(root, options);
  try {
    return await run();
  } finally {
    lock.release();
  }
}
