import { CanvasTexture, SRGBColorSpace, Texture } from 'three';

import { COVER_CACHE_MAX, COVER_H, COVER_W, type StudyBook } from '@/lib';

import { FONT_STACK } from './atlas';
import { SIDE_MIX } from './ShelfRow';
import { mixRgb, type Rgb, type Tokens } from './tokens';

export interface CoverCache {
  get: (id: number) => Texture | null;
  ensure: (book: StudyBook) => Promise<Texture>;
  prefetch: (ids: readonly number[]) => void;
  dispose: () => void;
  size: () => number;
}

export interface CoverCacheOptions {
  upload?: (texture: Texture) => void;
}

const BAND_MIX = 0.7;
const TEXT_ALPHA = 0.8;
const PAD = 20;

const css = (rgb: Rgb) => `rgb(${rgb.map((v) => Math.round(v)).join(',')})`;

export const coverUrl = (id: number) => `/api/books/${id}/cover`;

export function drawCover(book: StudyBook, tokens: Tokens): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const tone = tokens[`chart-${book.tone}`];
    const band = COVER_H * 0.62;
    ctx.fillStyle = css(mixRgb(tone, tokens.muted, SIDE_MIX));
    ctx.fillRect(0, 0, COVER_W, COVER_H);
    ctx.fillStyle = css(mixRgb(tone, tokens.muted, BAND_MIX));
    ctx.fillRect(0, band, COVER_W, 6);
    ctx.fillStyle = css(tokens.foreground);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `700 ${book.cjk ? 34 : 28}px ${FONT_STACK}`;
    const words = book.cjk ? [...book.title] : book.title.split(' ');
    const lineHeight = book.cjk ? 42 : 34;
    let line = '';
    let y = 28;
    for (const word of words) {
      const next = book.cjk ? line + word : line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > COVER_W - PAD * 2 && line) {
        ctx.fillText(line, PAD, y);
        y += lineHeight;
        line = word;
      } else {
        line = next;
      }
    }
    ctx.fillText(line, PAD, y);
    ctx.font = `400 18px ${FONT_STACK}`;
    ctx.globalAlpha = TEXT_ALPHA;
    ctx.fillText(book.authors[0] ?? '', PAD, band + 18, COVER_W - PAD * 2);
    if (book.series) {
      const index = book.seriesIndex === null ? '' : ` #${book.seriesIndex}`;
      ctx.fillText(`${book.series}${index}`, PAD, band + 44, COVER_W - PAD * 2);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

async function loadCover(id: number): Promise<Texture> {
  const response = await fetch(coverUrl(id));
  if (!response.ok) throw new Error(`cover ${id}: ${response.status}`);
  // WebGL ignores UNPACK_FLIP_Y_WEBGL for an ImageBitmap, so the bitmap is decoded flipped and texture.flipY stays false.
  const bitmap = await createImageBitmap(await response.blob(), {
    resizeWidth: COVER_W,
    resizeHeight: COVER_H,
    resizeQuality: 'high',
    imageOrientation: 'flipY',
  });
  const texture = new Texture(bitmap);
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createCoverCache(
  tokens: Tokens,
  { upload }: CoverCacheOptions = {},
): CoverCache {
  const ready = new Map<number, Texture>();
  const pending = new Map<number, Promise<Texture>>();
  const prefetched = new Set<number>();
  let disposed = false;

  const touch = (id: number, texture: Texture) => {
    ready.delete(id);
    ready.set(id, texture);
    while (ready.size > COVER_CACHE_MAX) {
      const [oldest] = ready.keys();
      if (oldest === undefined) break;
      ready.get(oldest)?.dispose();
      ready.delete(oldest);
    }
  };

  const settle = (id: number, texture: Texture): Texture => {
    pending.delete(id);
    if (disposed) {
      texture.dispose();
      return texture;
    }
    upload?.(texture);
    touch(id, texture);
    return texture;
  };

  return {
    get: (id) => {
      const texture = ready.get(id);
      if (!texture) return null;
      touch(id, texture);
      return texture;
    },
    ensure: (book) => {
      const hit = ready.get(book.id);
      if (hit) {
        touch(book.id, hit);
        return Promise.resolve(hit);
      }
      const inFlight = pending.get(book.id);
      if (inFlight) return inFlight;
      if (!book.hasCover) {
        return Promise.resolve(settle(book.id, drawCover(book, tokens)));
      }
      const promise = loadCover(book.id)
        .catch(() => drawCover(book, tokens))
        .then((texture) => settle(book.id, texture));
      pending.set(book.id, promise);
      return promise;
    },
    prefetch: (ids) => {
      for (const id of ids) {
        if (prefetched.has(id) || ready.has(id) || pending.has(id)) continue;
        prefetched.add(id);
        fetch(coverUrl(id))
          .then((response) => response.arrayBuffer())
          .catch(() => undefined);
      }
    },
    dispose: () => {
      disposed = true;
      for (const texture of ready.values()) texture.dispose();
      ready.clear();
    },
    size: () => ready.size,
  };
}
