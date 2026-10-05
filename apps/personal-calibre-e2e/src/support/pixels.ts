import type { Page } from '@playwright/test';

export interface PixelDiff {
  total: number;
  mismatched: number;
  ratio: number;
  offEdge: number;
}

export const PARITY_TOLERANCE = 12;
const EDGE_LUMINANCE_RANGE = 12;
const EDGE_REACH = 2;

export async function diffScreenshots(
  page: Page,
  reference: Buffer,
  candidate: Buffer,
  tolerance = PARITY_TOLERANCE,
): Promise<PixelDiff> {
  return page.evaluate(
    async ({ reference, candidate, tolerance, edgeRange, reach }) => {
      const decode = async (base64: string) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes]));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const a = await decode(reference);
      const b = await decode(candidate);
      if (a.width !== b.width || a.height !== b.height) {
        throw new Error(
          `size differs: ${a.width}×${a.height} vs ${b.width}×${b.height}`,
        );
      }
      const { width, height } = a;
      const luma = new Float32Array(width * height);
      for (let i = 0; i < width * height; i++) {
        luma[i] =
          0.2126 * (a.data[i * 4] ?? 0) +
          0.7152 * (a.data[i * 4 + 1] ?? 0) +
          0.0722 * (a.data[i * 4 + 2] ?? 0);
      }
      const edge = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let min = Infinity;
          let max = -Infinity;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
              const v = luma[ny * width + nx] ?? 0;
              if (v < min) min = v;
              if (v > max) max = v;
            }
          }
          if (max - min > edgeRange) edge[y * width + x] = 1;
        }
      }
      const nearEdge = (x: number, y: number) => {
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (edge[ny * width + nx]) return true;
          }
        }
        return false;
      };
      let mismatched = 0;
      let offEdge = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          let over = false;
          for (let c = 0; c < 3; c++) {
            if (
              Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0)) > tolerance
            ) {
              over = true;
            }
          }
          if (!over) continue;
          mismatched++;
          if (!nearEdge(x, y)) offEdge++;
        }
      }
      const total = width * height;
      return { total, mismatched, ratio: mismatched / total, offEdge };
    },
    {
      reference: reference.toString('base64'),
      candidate: candidate.toString('base64'),
      tolerance,
      edgeRange: EDGE_LUMINANCE_RANGE,
      reach: EDGE_REACH,
    },
  );
}
