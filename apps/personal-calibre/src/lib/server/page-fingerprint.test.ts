import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { writtenPage } from '@/test';

import {
  fingerprintPage,
  MIN_INK,
  pageSimilarity,
  SAME_PAGE_SIMILARITY,
} from './page-fingerprint';

describe('page fingerprints', () => {
  it('match the same page re-encoded at another size and quality', async () => {
    const a = await fingerprintPage(await writtenPage(1));
    const b = await fingerprintPage(
      await writtenPage(1, { width: 420, height: 595, quality: 60 }),
    );
    expect(pageSimilarity(a.thumbnail, b.thumbnail)).toBeGreaterThanOrEqual(
      SAME_PAGE_SIMILARITY,
    );
  });

  it('tell different pages apart', async () => {
    const a = await fingerprintPage(await writtenPage(1));
    const b = await fingerprintPage(await writtenPage(2));
    expect(pageSimilarity(a.thumbnail, b.thumbnail)).toBeLessThan(
      SAME_PAGE_SIMILARITY,
    );
  });

  it('measure a blank page as having almost no ink', async () => {
    const blank = await sharp({
      create: { width: 300, height: 420, channels: 3, background: '#f5f5f5' },
    })
      .jpeg()
      .toBuffer();
    expect((await fingerprintPage(new Uint8Array(blank))).ink).toBeLessThan(
      MIN_INK,
    );
    expect((await fingerprintPage(await writtenPage(3))).ink).toBeGreaterThan(
      MIN_INK,
    );
  });
});
