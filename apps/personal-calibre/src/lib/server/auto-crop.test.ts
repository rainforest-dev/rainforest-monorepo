import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { isSkinOrDesk } from '@/lib/page-crop';

import { autoCropPage } from './auto-crop';
import type { PageUpload } from './notebooks';

type Paint = (x: number, y: number) => [number, number, number];

const DESK: [number, number, number] = [70, 70, 75];
const PAPER: [number, number, number] = [245, 245, 245];
const INK: [number, number, number] = [40, 40, 45];
const SKIN: [number, number, number] = [220, 160, 130];

async function photo(
  width: number,
  height: number,
  paint: Paint,
): Promise<PageUpload> {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(paint(x, y), (y * width + x) * 3);
    }
  }
  const bytes = await sharp(data, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
  return { name: 'scan.jpg', type: 'image/jpeg', bytes: new Uint8Array(bytes) };
}

const inside = (x: number, y: number, [x0, y0, x1, y1]: number[]) =>
  x >= x0 && x < x1 && y >= y0 && y < y1;

async function sizeOf(page: PageUpload) {
  const { width, height } = await sharp(page.bytes).metadata();
  return { width, height };
}

async function skinPixels(page: PageUpload): Promise<number> {
  const { data } = await sharp(page.bytes)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let count = 0;
  for (let i = 0; i < data.length; i += 3) {
    if (isSkinOrDesk(data[i], data[i + 1], data[i + 2])) count++;
  }
  return count;
}

describe('autoCropPage', () => {
  it('splits a spread photographed sideways and turns both pages upright', async () => {
    const paper = [100, 80, 500, 720];
    const upload = await photo(600, 800, (x, y) => {
      if (!inside(x, y, paper)) return DESK;
      if (Math.abs(y - 400) < 8) return [190, 190, 190];
      if (
        inside(x, y, [380, 150, 400, 350]) ||
        inside(x, y, [380, 450, 400, 650])
      )
        return INK;
      return PAPER;
    });

    const pages = await autoCropPage(upload);

    expect(pages.map((p) => p.name)).toEqual([
      'scan-left.jpg',
      'scan-right.jpg',
    ]);
    for (const page of pages) {
      const { width = 0, height = 0 } = await sizeOf(page);
      expect(height).toBeGreaterThan(width);
    }
  });

  it('splits a landscape spread down the middle without turning it', async () => {
    const paper = [100, 120, 700, 480];
    const upload = await photo(800, 600, (x, y) =>
      inside(x, y, paper) ? PAPER : DESK,
    );

    const pages = await autoCropPage(upload);

    expect(pages.map((p) => p.name)).toEqual([
      'scan-left.jpg',
      'scan-right.jpg',
    ]);
    const { width = 0, height = 0 } = await sizeOf(pages[0]);
    expect(width).toBeCloseTo(300, -1);
    expect(height).toBeCloseTo(360, -1);
  });

  it('crops a single page to the paper and paints out a finger on its margin', async () => {
    const paper = [100, 80, 500, 720];
    const upload = await photo(600, 800, (x, y) => {
      if (inside(x, y, [60, 380, 130, 420])) return SKIN;
      if (!inside(x, y, paper)) return DESK;
      if (inside(x, y, [200, 200, 400, 210])) return INK;
      return PAPER;
    });

    const pages = await autoCropPage(upload);

    expect(pages.map((p) => p.name)).toEqual(['scan.jpg']);
    const { width = 0, height = 0 } = await sizeOf(pages[0]);
    expect(width).toBeCloseTo(400, -1);
    expect(height).toBeCloseTo(640, -1);
    expect(await skinPixels(pages[0])).toBe(0);
  });

  it('returns the upload untouched when no page outline is found', async () => {
    const upload = await photo(120, 90, () => PAPER);
    expect(await autoCropPage(upload)).toEqual([upload]);
  });

  it('returns an unreadable upload untouched', async () => {
    const upload = {
      name: 'broken.jpg',
      type: 'image/jpeg',
      bytes: new Uint8Array(16),
    };
    expect(await autoCropPage(upload)).toEqual([upload]);
  });
});
