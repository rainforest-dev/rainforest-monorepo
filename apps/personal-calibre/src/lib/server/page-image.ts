import decodeHeic from 'heic-decode';
import sharp from 'sharp';

/** Longest edge a stored page keeps: about 360 dpi on an A5 page, plenty for handwriting. */
export const MAX_PAGE_EDGE = 3000;

export interface PageImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/** Pixels sharp can read, decoding HEIC itself: sharp's prebuilt libvips has no HEVC decoder. */
async function openImage(bytes: Uint8Array, mimeType: string) {
  if (mimeType !== 'image/heic') return sharp(bytes);
  const { width, height, data } = await decodeHeic({ buffer: bytes });
  return sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
    raw: { width, height, channels: 4 },
  });
}

/**
 * Re-encodes a page photo as an upright sRGB JPEG no larger than `MAX_PAGE_EDGE`, whatever it
 * arrived as. Every stored page is then something a browser, Claude and the PDF export can all
 * read as is. Throws when the bytes are not a readable image.
 */
export async function normalizePageImage(
  bytes: Uint8Array,
  mimeType: string,
): Promise<PageImage> {
  const image = await openImage(bytes, mimeType);
  const { data, info } = await image
    .rotate()
    .resize(MAX_PAGE_EDGE, MAX_PAGE_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return {
    bytes: new Uint8Array(data),
    width: info.width,
    height: info.height,
  };
}
