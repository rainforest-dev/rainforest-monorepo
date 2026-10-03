import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import sharp from 'sharp';

// The homelab container's 512 MiB limit is smaller than libvips' default thread pool + cache.
sharp.concurrency(1);
sharp.cache(false);

export const THUMB_WIDTHS = [240, 480, 960] as const;

export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

export function parseWidth(raw: string | null): ThumbWidth | undefined {
  const n = Number(raw);
  return (THUMB_WIDTHS as readonly number[]).includes(n)
    ? (n as ThumbWidth)
    : undefined;
}

export function thumbCacheDir(): string {
  return process.env['MEMORIES_CACHE_DIR'] || join(tmpdir(), 'memories-thumbs');
}

export function thumbPath(
  cacheDir: string,
  id: string,
  n: number,
  w: ThumbWidth,
  mtimeMs: number,
): string {
  const hash = createHash('sha1').update(`${id}:${n}:${mtimeMs}`).digest('hex');
  return join(cacheDir, `${hash}-${w}.webp`);
}

export const MAX_CONCURRENT_ENCODES = 2;

let activeEncodes = 0;
const encodeQueue: Array<() => void> = [];

function acquireEncodeSlot(): Promise<void> {
  if (activeEncodes < MAX_CONCURRENT_ENCODES) {
    activeEncodes++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    encodeQueue.push(() => {
      activeEncodes++;
      resolve();
    });
  });
}

function releaseEncodeSlot(): void {
  activeEncodes--;
  encodeQueue.shift()?.();
}

export function withEncodeSlot<T>(fn: () => Promise<T>): Promise<T> {
  return acquireEncodeSlot().then(() => fn().finally(releaseEncodeSlot));
}

const inFlight = new Map<string, Promise<void>>();
const failedDests = new Set<string>();

const UNDECODABLE_SOURCE =
  /unsupported image format|input (file|buffer)|heif|bad seek|vipsjpeg/i;

// fs/OS errors (ENOSPC, EMFILE…) carry a `code`; sharp's own decode errors don't.
function isUndecodableSource(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) return false;
  const message = err instanceof Error ? err.message : String(err);
  return UNDECODABLE_SOURCE.test(message);
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

export function ensureThumb(
  src: string,
  dest: string,
  w: ThumbWidth,
): Promise<void> {
  if (failedDests.has(dest)) {
    return Promise.reject(new Error('thumbnail encode previously failed'));
  }

  const running = inFlight.get(dest);
  if (running) return running;

  const task = (async () => {
    if (await exists(dest)) return;
    await withEncodeSlot(async () => {
      if (await exists(dest)) return;
      await mkdir(dirname(dest), { recursive: true });
      const tmp = `${dest}.${randomUUID()}.tmp`;
      try {
        await sharp(src)
          .resize({ width: w, withoutEnlargement: true })
          .webp()
          .toFile(tmp);
        await rename(tmp, dest);
      } catch (err) {
        await rm(tmp, { force: true });
        if (isUndecodableSource(err)) failedDests.add(dest);
        throw err;
      }
    });
  })().finally(() => inFlight.delete(dest));

  inFlight.set(dest, task);
  return task;
}

// Transparent, so the tile's own muted background shows through in either colour scheme.
export const NOT_LOCAL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1"/>';
