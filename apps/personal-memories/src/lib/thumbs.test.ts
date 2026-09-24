import { mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { ensureThumb, parseWidth, thumbPath } from './thumbs.ts';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const root = mkdtempSync(join(tmpdir(), 'memories-thumbs-'));

describe('parseWidth', () => {
  it('accepts the three allowed widths', () => {
    expect(parseWidth('240')).toBe(240);
    expect(parseWidth('480')).toBe(480);
    expect(parseWidth('960')).toBe(960);
  });

  it('rejects anything outside the allowed set', () => {
    expect(parseWidth('320')).toBeUndefined();
    expect(parseWidth('0')).toBeUndefined();
    expect(parseWidth('abc')).toBeUndefined();
    expect(parseWidth(null)).toBeUndefined();
  });
});

describe('thumbPath', () => {
  it('changes when the source mtime changes', () => {
    const a = thumbPath(root, 'P1', 0, 480, 1000);
    const b = thumbPath(root, 'P1', 0, 480, 2000);
    expect(a).not.toBe(b);
  });

  it('is stable for the same inputs', () => {
    expect(thumbPath(root, 'P1', 0, 480, 1000)).toBe(
      thumbPath(root, 'P1', 0, 480, 1000),
    );
  });
});

describe('ensureThumb', () => {
  it('never upscales a source smaller than the target width', async () => {
    const src = join(root, 'pixel.png');
    writeFileSync(src, PIXEL_PNG);
    const dest = join(root, 'pixel-480.webp');

    await ensureThumb(src, dest, 480);

    const meta = await sharp(dest).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1);
  });

  it('caps a larger source to the requested width', async () => {
    const src = join(root, 'big.png');
    await sharp({
      create: { width: 1200, height: 800, channels: 3, background: '#ffffff' },
    })
      .png()
      .toFile(src);
    const dest = join(root, 'big-480.webp');

    await ensureThumb(src, dest, 480);

    const meta = await sharp(dest).metadata();
    expect(meta.width).toBe(480);
    expect(meta.height).toBe(320);
  });

  it('reuses the cached file on a second call instead of rewriting it', async () => {
    const src = join(root, 'big.png');
    const dest = join(root, 'big-480.webp');
    const before = statSync(dest).mtimeMs;

    await ensureThumb(src, dest, 480);

    expect(statSync(dest).mtimeMs).toBe(before);
  });
});
