import { fullQuad, type Quad, type Raster } from './geometry';
import { homography } from './homography';

/**
 * Straightens the part of `source` inside `quad` into a `width` × `height` rectangle: each output
 * pixel is mapped back through the homography and sampled bilinearly. The result is opaque.
 */
export function warpQuad(
  source: Raster,
  quad: Quad,
  width: number,
  height: number,
): Raster {
  const h = homography(fullQuad(width, height), quad);
  if (!h) throw new Error('The page outline is degenerate');
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = h;
  const { data: src, width: sw, height: sh } = source;
  const out = new Uint8ClampedArray(width * height * 4);
  const maxX = sw - 1;
  const maxY = sh - 1;

  for (let y = 0; y < height; y++) {
    const cy = y + 0.5;
    for (let x = 0; x < width; x++) {
      const cx = x + 0.5;
      const w = h6 * cx + h7 * cy + h8;
      // Source position in pixel-centre coordinates.
      const sx = (h0 * cx + h1 * cy + h2) / w - 0.5;
      const sy = (h3 * cx + h4 * cy + h5) / w - 0.5;
      const fx = Math.floor(sx);
      const fy = Math.floor(sy);
      const tx = sx - fx;
      const ty = sy - fy;
      const x0 = fx < 0 ? 0 : fx > maxX ? maxX : fx;
      const x1 = fx + 1 < 0 ? 0 : fx + 1 > maxX ? maxX : fx + 1;
      const y0 = fy < 0 ? 0 : fy > maxY ? maxY : fy;
      const y1 = fy + 1 < 0 ? 0 : fy + 1 > maxY ? maxY : fy + 1;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * tx;
        const bottom = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * tx;
        out[o + c] = top + (bottom - top) * ty;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, width, height };
}
