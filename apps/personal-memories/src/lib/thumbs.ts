import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import sharp from 'sharp';

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

export async function ensureThumb(
  src: string,
  dest: string,
  w: ThumbWidth,
): Promise<void> {
  if (existsSync(dest)) return;
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.tmp`;
  await sharp(src)
    .resize({ width: w, withoutEnlargement: true })
    .webp()
    .toFile(tmp);
  renameSync(tmp, dest);
}
