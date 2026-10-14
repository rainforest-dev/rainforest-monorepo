import path from 'node:path';

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
} from 'pdf-lib';
import sharp from 'sharp';

/** The largest PDF accepted as a batch of scanned pages. */
export const MAX_PDF_BYTES = 100 * 1024 * 1024;

/** The most pages one PDF may expand into. */
export const MAX_PDF_PAGES = 200;

export const SCANNED_PDFS_ONLY =
  'only scanned PDFs are supported, where each page is a single JPEG image (as the iPhone document scanner makes)';

export type PdfPagesResult =
  | {
      ok: true;
      pages: Array<{ name: string; type: 'image/jpeg'; bytes: Uint8Array }>;
    }
  | { ok: false; status: 413 | 415; message: string };

export const isPdf = (file: { name: string; type: string }): boolean =>
  file.type.trim().toLowerCase() === 'application/pdf' ||
  path.extname(file.name).toLowerCase() === '.pdf';

const IMAGE = PDFName.of('Image');
const FORM = PDFName.of('Form');
const DCT = PDFName.of('DCTDecode');

/**
 * Every image XObject a page can draw: those in its resources and in the resources of any form
 * XObject it uses, each stream counted once.
 */
function pageImages(resources: PDFDict | undefined): PDFRawStream[] {
  const found = new Set<PDFRawStream>();
  const seenForms = new Set<PDFRawStream>();
  const visit = (res: PDFDict | undefined) => {
    const xObjects = res?.lookupMaybe(PDFName.of('XObject'), PDFDict);
    if (!xObjects) return;
    for (const key of xObjects.keys()) {
      const stream = xObjects.lookup(key);
      if (!(stream instanceof PDFRawStream)) continue;
      const subtype = stream.dict.lookup(PDFName.of('Subtype'));
      if (subtype === IMAGE) {
        found.add(stream);
      } else if (subtype === FORM && !seenForms.has(stream)) {
        seenForms.add(stream);
        visit(stream.dict.lookupMaybe(PDFName.of('Resources'), PDFDict));
      }
    }
  };
  visit(resources);
  return [...found];
}

/** Whether the stream holds plain JPEG bytes: `DCTDecode` as its only filter. */
function isJpegStream(stream: PDFRawStream): boolean {
  const filter = stream.dict.lookup(PDFName.of('Filter'));
  if (filter === DCT) return true;
  return (
    filter instanceof PDFArray &&
    filter.size() === 1 &&
    filter.lookup(0) === DCT
  );
}

/**
 * Drops EXIF (APP1) segments from a JPEG. A PDF viewer ignores any orientation tag in an
 * embedded JPEG, but page normalisation honours it, so a stray tag would turn the page.
 */
export function stripExif(jpeg: Uint8Array): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const kept: Uint8Array[] = [jpeg.subarray(0, 2)];
  let offset = 2;
  let dropped = false;
  while (offset + 4 <= jpeg.length && jpeg[offset] === 0xff) {
    const marker = jpeg[offset + 1];
    // Start of scan: the rest is entropy-coded data, kept as it is.
    if (marker === 0xda) break;
    const length = (jpeg[offset + 2] << 8) | jpeg[offset + 3];
    const end = offset + 2 + length;
    if (length < 2 || end > jpeg.length) return jpeg;
    if (marker === 0xe1) {
      dropped = true;
    } else {
      kept.push(jpeg.subarray(offset, end));
    }
    offset = end;
  }
  if (!dropped) return jpeg;
  kept.push(jpeg.subarray(offset));
  return new Uint8Array(Buffer.concat(kept));
}

/** The page's `/Rotate`, inherited from the page tree, as 0, 90, 180 or 270. */
function pageRotation(rotate: PDFNumber | undefined): number {
  const degrees = rotate?.asNumber() ?? 0;
  return (((Math.round(degrees / 90) * 90) % 360) + 360) % 360;
}

/**
 * Splits a scanned PDF into one JPEG per page, in page order, named `<pdf name>-p001.jpg` and
 * so on. Each page must draw exactly one JPEG (`DCTDecode`) image, whose bytes are taken as
 * they are; nothing is rasterised. A PDF with any other page (text, vector art, JBIG2 or Flate
 * images, several images) is refused whole.
 */
export async function extractPdfPages(
  name: string,
  bytes: Uint8Array,
): Promise<PdfPagesResult> {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, {
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
  } catch (error) {
    const encrypted = /encrypted/i.test(String(error));
    return {
      ok: false,
      status: 415,
      message: `${name}: ${encrypted ? 'an encrypted PDF cannot be read' : 'not a readable PDF'}`,
    };
  }

  const pages = pdf.getPages();
  if (pages.length === 0) {
    return { ok: false, status: 415, message: `${name}: the PDF has no pages` };
  }
  if (pages.length > MAX_PDF_PAGES) {
    return {
      ok: false,
      status: 413,
      message: `${name}: ${pages.length} pages is more than the ${MAX_PDF_PAGES}-page limit`,
    };
  }

  const base = path.basename(name, path.extname(name)) || 'scan';
  const digits = Math.max(3, String(pages.length).length);
  const result: Array<{
    name: string;
    type: 'image/jpeg';
    bytes: Uint8Array;
  }> = [];

  for (const [index, page] of pages.entries()) {
    const images = pageImages(page.node.Resources());
    const refuse = (why: string): PdfPagesResult => ({
      ok: false,
      status: 415,
      message: `${name}: page ${index + 1} ${why}; ${SCANNED_PDFS_ONLY}`,
    });
    if (images.length === 0) return refuse('has no image');
    if (images.length > 1) return refuse(`has ${images.length} images`);
    if (!isJpegStream(images[0])) return refuse('is not a JPEG image');

    let jpeg = stripExif(images[0].getContents());
    const rotation = pageRotation(page.node.Rotate());
    if (rotation !== 0) {
      // A turned page has to be re-encoded to stay upright once out of the PDF.
      try {
        jpeg = new Uint8Array(
          await sharp(jpeg).rotate(rotation).jpeg({ quality: 92 }).toBuffer(),
        );
      } catch {
        return refuse('has an unreadable JPEG image');
      }
    }
    result.push({
      name: `${base}-p${String(index + 1).padStart(digits, '0')}.jpg`,
      type: 'image/jpeg',
      bytes: jpeg,
    });
  }
  return { ok: true, pages: result };
}
