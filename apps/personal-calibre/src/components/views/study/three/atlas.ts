import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three';

import {
  type AtlasPpu,
  isCjk,
  type PlacedBook,
  rowAtlasBytes,
  rowAtlasSize,
  textureBytes,
} from '@/lib';

import { mixRgb, type Rgb, type Tokens } from './tokens';

export const FONT_STACK =
  '"Helvetica Neue", Arial, "PingFang TC", "Noto Sans TC", "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif';
const REFERENCE_PPU = 160;
const STRIPE_MIX = 0.36;
const FILL_MIX = 0.24;
const BAND_MIX = 0.55;
const AUTHOR_ALPHA = 0.72;

export type AtlasRect = readonly [number, number, number, number];

export interface RowAtlas {
  row: number;
  texture: CanvasTexture;
  rects: ReadonlyMap<number, AtlasRect>;
  bytes: number;
}

interface SpineBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const css = (rgb: Rgb) => `rgb(${rgb.map((v) => Math.round(v)).join(',')})`;

function drawUpright(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  top: number,
  size: number,
  step: number,
): void {
  [...text].forEach((char, i) => {
    ctx.fillText(char, cx, top + size * 0.54 + i * size * step);
  });
}

function drawRotated(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 2);
  ctx.fillText(text, 0, 0, maxWidth);
  ctx.restore();
}

export function drawSpine(
  ctx: CanvasRenderingContext2D,
  placed: PlacedBook,
  box: SpineBox,
  tokens: Tokens,
  ppu: AtlasPpu,
): void {
  const { x, y, w, h } = box;
  const { book } = placed;
  const scale = ppu / REFERENCE_PPU;
  const tone = tokens[`chart-${book.tone}`];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = css(mixRgb(tone, tokens.muted, FILL_MIX));
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = css(mixRgb(tone, tokens.muted, STRIPE_MIX));
  ctx.lineWidth = 8 * scale;
  const stride = 16 * scale;
  for (let s = -w; s < h + w; s += stride) {
    ctx.beginPath();
    ctx.moveTo(x, y + s + w);
    ctx.lineTo(x + w, y + s);
    ctx.stroke();
  }
  const band = Math.round(0.07 * ppu);
  ctx.fillStyle = css(mixRgb(tone, tokens.muted, BAND_MIX));
  ctx.fillRect(x, y, w, band);
  ctx.fillRect(x, y + h - band, w, band);

  ctx.fillStyle = css(tokens.foreground);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = x + w / 2;
  const pad = 10 * scale;
  const top = y + band + pad;
  const authorBox = Math.round(h * 0.2);
  const avail = h - band * 2 - pad * 2 - authorBox;
  const author = book.authors[0] ?? '';
  const authorTop = y + h - band - authorBox;

  if (book.cjk) {
    const chars = [...book.title].length;
    const size = Math.min(w * 0.58, avail / chars / 1.08);
    ctx.font = `600 ${size}px ${FONT_STACK}`;
    drawUpright(ctx, book.title, cx, top, size, 1.08);
  } else {
    let size = Math.min(w * 0.42, 22 * scale);
    ctx.font = `600 ${size}px ${FONT_STACK}`;
    const width = ctx.measureText(book.title).width;
    if (width > avail) size = Math.max(10 * scale, (size * avail) / width);
    ctx.font = `600 ${size}px ${FONT_STACK}`;
    drawRotated(ctx, book.title, cx, top + avail / 2, avail);
  }

  ctx.globalAlpha = AUTHOR_ALPHA;
  if (isCjk(author)) {
    const chars = [...author].length;
    const size = Math.min(w * 0.42, (authorBox - 8 * scale) / chars / 1.05);
    ctx.font = `400 ${size}px ${FONT_STACK}`;
    drawUpright(ctx, author, cx, authorTop + 4 * scale, size, 1.05);
  } else {
    const last = author.split(' ').at(-1) ?? '';
    ctx.font = `400 ${Math.min(w * 0.34, 16 * scale)}px ${FONT_STACK}`;
    drawRotated(
      ctx,
      last,
      cx,
      authorTop + authorBox / 2,
      authorBox - 8 * scale,
    );
  }
  ctx.restore();
}

function spineBox(
  placed: PlacedBook,
  canvasHeight: number,
  ppu: AtlasPpu,
): SpineBox {
  const x = Math.round((placed.x - placed.t / 2) * ppu);
  const right = Math.round((placed.x + placed.t / 2) * ppu);
  const h = Math.min(canvasHeight, Math.round(placed.h * ppu));
  return { x, y: canvasHeight - h, w: right - x, h };
}

export function buildRowAtlas(
  books: readonly PlacedBook[],
  rowWidthUnits: number,
  tokens: Tokens,
  maxAnisotropy: number,
  ppu: AtlasPpu,
): RowAtlas {
  const { width, height } = rowAtlasSize(rowWidthUnits, ppu);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const rects = new Map<number, AtlasRect>();
  for (const placed of books) {
    const box = spineBox(placed, height, ppu);
    if (ctx) drawSpine(ctx, placed, box, tokens, ppu);
    rects.set(placed.book.id, [
      box.x / width,
      (height - box.y - box.h) / height,
      box.w / width,
      box.h / height,
    ]);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return {
    row: books[0]?.row ?? 0,
    texture,
    rects,
    bytes: rowAtlasBytes(rowWidthUnits, ppu),
  };
}

function cropBox(atlas: RowAtlas, bookId: number) {
  const source = atlas.texture.image as HTMLCanvasElement;
  const [u, v, du, dv] = atlas.rects.get(bookId) ?? [0, 0, 1, 1];
  return {
    source,
    u,
    v,
    dv,
    w: Math.max(1, Math.round(du * source.width)),
    h: Math.max(1, Math.round(dv * source.height)),
  };
}

export function spineCropBytes(
  atlases: ReadonlyMap<number, RowAtlas> | undefined,
  bookIds: ReadonlySet<number | null>,
): number {
  let bytes = 0;
  for (const bookId of bookIds) {
    if (bookId === null) continue;
    for (const atlas of atlases?.values() ?? []) {
      if (!atlas.rects.has(bookId)) continue;
      const { w, h } = cropBox(atlas, bookId);
      bytes += textureBytes(w, h);
      break;
    }
  }
  return bytes;
}

export function cropSpine(atlas: RowAtlas, bookId: number): CanvasTexture {
  const { source, u, v, dv, w, h } = cropBox(atlas, bookId);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas
    .getContext('2d')
    ?.drawImage(
      source,
      Math.round(u * source.width),
      Math.round((1 - v - dv) * source.height),
      w,
      h,
      0,
      0,
      w,
      h,
    );
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
