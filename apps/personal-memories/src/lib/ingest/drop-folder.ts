import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { extname, join } from 'node:path';

export const REJECTED_DIR = 'rejected';
export const SETTLE_MS = 10_000;

const ICLOUD_STUB = /^\.(.+)\.icloud$/;

export type InboxListing = {
  name: string;
  isFile: boolean;
  mtimeMs: number;
  dataless: boolean;
};

export type InboxEntry =
  | { kind: 'ready'; name: string; path: string }
  | { kind: 'placeholder'; name: string; path: string; download: string }
  | { kind: 'settling'; name: string; path: string }
  | { kind: 'reject'; name: string; path: string; reason: string };

export function planInbox(
  dir: string,
  listing: readonly InboxListing[],
  now: number,
): InboxEntry[] {
  const entries: InboxEntry[] = [];
  for (const item of [...listing].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    const path = join(dir, item.name);
    const stub = ICLOUD_STUB.exec(item.name);
    if (stub?.[1]) {
      entries.push({
        kind: 'placeholder',
        name: item.name,
        path,
        download: join(dir, stub[1]),
      });
    } else if (item.name.startsWith('.') || item.name === REJECTED_DIR) {
      continue;
    } else if (!item.isFile) {
      entries.push({
        kind: 'reject',
        name: item.name,
        path,
        reason: 'not a file',
      });
    } else if (item.dataless) {
      entries.push({
        kind: 'placeholder',
        name: item.name,
        path,
        download: path,
      });
    } else if (now - item.mtimeMs < SETTLE_MS) {
      entries.push({ kind: 'settling', name: item.name, path });
    } else if (extname(item.name).toLowerCase() !== '.txt') {
      entries.push({
        kind: 'reject',
        name: item.name,
        path,
        reason: 'not a .txt file',
      });
    } else {
      entries.push({ kind: 'ready', name: item.name, path });
    }
  }
  return entries;
}

export function isDataless(path: string): boolean {
  if (process.platform !== 'darwin') return false;
  const out = spawnSync('stat', ['-f', '%Sf', path], { encoding: 'utf8' });
  return out.status === 0 && out.stdout.trim().split(',').includes('dataless');
}

export function downloadFromICloud(path: string): string | undefined {
  const out = spawnSync('brctl', ['download', path], { encoding: 'utf8' });
  if (out.error) return (out.error as NodeJS.ErrnoException).code ?? 'error';
  return out.status === 0 ? undefined : `exit ${out.status}`;
}

export function listInbox(
  dir: string,
  dataless: (path: string) => boolean = isDataless,
): InboxListing[] {
  return readdirSync(dir, { withFileTypes: true }).map((entry) => {
    const path = join(dir, entry.name);
    const isFile = entry.isFile();
    return {
      name: entry.name,
      isFile,
      mtimeMs: statSync(path).mtimeMs,
      dataless: isFile && !entry.name.startsWith('.') && dataless(path),
    };
  });
}

export function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

export function moveToRejected(
  dropDir: string,
  path: string,
  name: string,
  reason: string,
  hash8: string,
): string {
  const dir = join(dropDir, REJECTED_DIR);
  mkdirSync(dir, { recursive: true });
  const ext = extname(name);
  const target = existsSync(join(dir, name))
    ? join(dir, `${name.slice(0, name.length - ext.length)}-${hash8}${ext}`)
    : join(dir, name);
  renameSync(path, target);
  writeFileSync(`${target}.reason.txt`, `${reason}\n`);
  return target;
}
