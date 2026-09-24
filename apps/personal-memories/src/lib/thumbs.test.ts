import { mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

import {
  ensureThumb,
  MAX_CONCURRENT_ENCODES,
  parseWidth,
  thumbPath,
  withEncodeSlot,
} from './thumbs.ts';

vi.mock('sharp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sharp')>();
  const mocked = vi.fn(actual.default);
  Object.assign(mocked, actual.default);
  return { ...actual, default: mocked as unknown as typeof actual.default };
});

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

  it('de-duplicates concurrent calls for the same destination and leaves no tmp file', async () => {
    const src = join(root, 'dedup.png');
    await sharp({
      create: { width: 600, height: 400, channels: 3, background: '#000000' },
    })
      .png()
      .toFile(src);
    const dest = join(root, 'dedup-480.webp');

    const mockedSharp = vi.mocked(sharp);
    const callsBefore = mockedSharp.mock.calls.length;

    await Promise.all([
      ensureThumb(src, dest, 480),
      ensureThumb(src, dest, 480),
      ensureThumb(src, dest, 480),
      ensureThumb(src, dest, 480),
    ]);

    expect(mockedSharp.mock.calls.length - callsBefore).toBe(1);

    const meta = await sharp(dest).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(480);

    const leftoverTmp = readdirSync(root).filter(
      (name) => name.startsWith('dedup-480.webp.') && name.endsWith('.tmp'),
    );
    expect(leftoverTmp).toHaveLength(0);
  });
});

describe('withEncodeSlot', () => {
  it('bounds concurrent workers to MAX_CONCURRENT_ENCODES', async () => {
    let active = 0;
    let maxActive = 0;

    const worker = () =>
      withEncodeSlot(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active--;
      });

    await Promise.all([worker(), worker(), worker(), worker(), worker()]);

    expect(maxActive).toBe(MAX_CONCURRENT_ENCODES);
  });
});
