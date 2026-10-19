import {
  DETECT_EDGE,
  detectPageQuad,
  fullQuad,
  type Quad,
  quadOutputSize,
  type Raster,
  scaleQuad,
  warpQuad,
} from '@/lib';

/** Long edge a stored page keeps, as on the server (`MAX_PAGE_EDGE`). */
const MAX_PAGE_EDGE = 3000;
/** Long edge of the pixels a crop reads: enough for a 3000 px page, inside phone canvas limits. */
const MAX_SOURCE_EDGE = 4096;
const JPEG_QUALITY = 0.9;

/** The image upright, or `null` when this browser cannot decode it (HEIC outside Safari). */
export async function decodeImage(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available');
  return ctx;
}

/** Draws the bitmap onto a canvas whose long edge is at most `maxEdge`. */
export function drawScaled(
  bitmap: ImageBitmap,
  maxEdge: number,
  canvas = document.createElement('canvas'),
): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = context(canvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function rasterOf(canvas: HTMLCanvasElement): Raster {
  return context(canvas).getImageData(0, 0, canvas.width, canvas.height);
}

/** The page outline found in the image, in 0..1 coordinates; the whole image when none is found. */
export function detectNormalisedQuad(bitmap: ImageBitmap): Quad {
  const raster = rasterOf(drawScaled(bitmap, DETECT_EDGE));
  const quad = detectPageQuad(raster) ?? fullQuad(raster.width, raster.height);
  return scaleQuad(quad, 1 / raster.width, 1 / raster.height);
}

const toJpeg = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('JPEG encoding failed')),
      'image/jpeg',
      JPEG_QUALITY,
    ),
  );

/**
 * Straightens each quad (0..1 coordinates) of the image into its own JPEG, in order, named after
 * the original file. The long edge of each page is at most 3000 px, as the shelf stores it.
 */
export async function cropPages(
  bitmap: ImageBitmap,
  quads: readonly Quad[],
  fileName: string,
): Promise<File[]> {
  const source = rasterOf(drawScaled(bitmap, MAX_SOURCE_EDGE));
  const stem = fileName.replace(/\.[^.]+$/, '') || 'page';
  const suffixes = quads.length === 2 ? ['-left', '-right'] : [''];
  const files: File[] = [];
  for (const [i, normalised] of quads.entries()) {
    const quad = scaleQuad(normalised, source.width, source.height);
    const { width, height } = quadOutputSize(quad, MAX_PAGE_EDGE);
    const page = warpQuad(source, quad, width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    context(canvas).putImageData(new ImageData(page.data, width, height), 0, 0);
    const blob = await toJpeg(canvas);
    files.push(
      new File([blob], `${stem}${suffixes[i] ?? `-${i + 1}`}.jpg`, {
        type: 'image/jpeg',
      }),
    );
  }
  return files;
}
