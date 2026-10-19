import sharp from 'sharp';

export const FINGERPRINT_EDGE = 64;
const MAX_SHIFT = 3;
export const SAME_PAGE_SIMILARITY = 0.88;
export const MIN_INK = 2.5;

export interface PageFingerprint {
  thumbnail: Uint8Array;
  ink: number;
}

export async function fingerprintPage(
  jpeg: Uint8Array,
): Promise<PageFingerprint> {
  const { data } = await sharp(jpeg)
    .greyscale()
    .resize(FINGERPRINT_EDGE * 4, FINGERPRINT_EDGE * 4, { fit: 'fill' })
    .blur(1)
    .resize(FINGERPRINT_EDGE, FINGERPRINT_EDGE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const thumbnail = new Uint8Array(data);
  return { thumbnail, ink: inkOf(thumbnail) };
}

export function inkOf(thumbnail: Uint8Array): number {
  let sum = 0;
  for (const value of thumbnail) sum += value;
  const mean = sum / thumbnail.length;
  let squares = 0;
  for (const value of thumbnail) squares += (value - mean) ** 2;
  return Math.sqrt(squares / thumbnail.length);
}

function centred(thumbnail: Uint8Array): Float64Array {
  const values = Float64Array.from(thumbnail);
  let sum = 0;
  for (const value of values) sum += value;
  const mean = sum / values.length;
  for (let i = 0; i < values.length; i++) values[i] -= mean;
  return values;
}

export function pageSimilarity(a: Uint8Array, b: Uint8Array): number {
  const n = FINGERPRINT_EDGE;
  if (a.length !== n * n || b.length !== n * n) return -1;
  const va = centred(a);
  const vb = centred(b);
  let best = -1;
  for (let dy = -MAX_SHIFT; dy <= MAX_SHIFT; dy++) {
    for (let dx = -MAX_SHIFT; dx <= MAX_SHIFT; dx++) {
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let y = Math.max(0, dy); y < Math.min(n, n + dy); y++) {
        for (let x = Math.max(0, dx); x < Math.min(n, n + dx); x++) {
          const pa = va[y * n + x];
          const pb = vb[(y - dy) * n + (x - dx)];
          dot += pa * pb;
          normA += pa * pa;
          normB += pb * pb;
        }
      }
      if (normA > 0 && normB > 0) {
        best = Math.max(best, dot / Math.sqrt(normA * normB));
      }
    }
  }
  return best;
}
