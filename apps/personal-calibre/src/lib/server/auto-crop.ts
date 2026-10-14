import {
  cleanMargins,
  defaultSeam,
  detectPageQuad,
  findStackedGutter,
  type Quad,
  quadOutputSize,
  type Raster,
  rotateCounterClockwise,
  splitSpread,
  splitStacked,
  SPREAD_ASPECT,
  warpQuad,
} from '@/lib/page-crop';

import { type PageUpload, resolvePageMimeType } from './notebooks';
import {
  decodePageRaster,
  encodePageRaster,
  MAX_PAGE_EDGE,
} from './page-image';

const GUTTER_EDGE = 512;

type Layout =
  | { kind: 'single'; quad: Quad }
  | { kind: 'side-by-side'; pages: [Quad, Quad] }
  | { kind: 'stacked'; pages: [Quad, Quad] };

function layoutOf(source: Raster): Layout | null {
  const quad = detectPageQuad(source);
  if (!quad) return null;
  const size = quadOutputSize(quad, GUTTER_EDGE);
  if (size.width > size.height * SPREAD_ASPECT) {
    return {
      kind: 'side-by-side',
      pages: splitSpread(quad, defaultSeam(quad)),
    };
  }
  const gutter = findStackedGutter(
    warpQuad(source, quad, size.width, size.height),
  );
  if (gutter === null) return { kind: 'single', quad };
  return { kind: 'stacked', pages: splitStacked(quad, gutter) };
}

function straighten(source: Raster, quad: Quad): Raster {
  const { width, height } = quadOutputSize(quad, MAX_PAGE_EDGE);
  return warpQuad(source, quad, width, height);
}

/**
 * Any failure inside detection, warping or encoding keeps the photo as uploaded, so a
 * crop problem can never lose a page or fail the rest of the batch.
 */
export async function autoCropPage(upload: PageUpload): Promise<PageUpload[]> {
  try {
    return await cropPage(upload);
  } catch {
    return [upload];
  }
}

async function cropPage(upload: PageUpload): Promise<PageUpload[]> {
  const mimeType = resolvePageMimeType(upload.name, upload.type);
  if (!mimeType) return [upload];
  const source = await decodePageRaster(upload.bytes, mimeType);

  const layout = layoutOf(source);
  if (!layout) return [upload];
  const pages =
    layout.kind === 'single'
      ? [straighten(source, layout.quad)]
      : layout.pages.map((quad) => {
          const page = straighten(source, quad);
          // A phone held upright over an open notebook frames it left page on top, turned clockwise.
          return layout.kind === 'stacked'
            ? rotateCounterClockwise(page)
            : page;
        });

  const stem = upload.name.replace(/\.[^.]+$/, '') || 'page';
  const suffixes = pages.length === 2 ? ['-left', '-right'] : [''];
  return Promise.all(
    pages.map(async (page, i) => {
      cleanMargins(page);
      return {
        name: `${stem}${suffixes[i]}.jpg`,
        type: 'image/jpeg',
        bytes: await encodePageRaster(page),
      };
    }),
  );
}

export async function autoCropPages(
  uploads: PageUpload[],
): Promise<PageUpload[]> {
  const pages: PageUpload[] = [];
  for (const upload of uploads) pages.push(...(await autoCropPage(upload)));
  return pages;
}
