import { degrees, PDFDocument, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';

/** A small real JPEG; `fill` sets its grey level, so different fills are different files. */
export async function jpegBytes(
  fill: number,
  { width = 8, height = 6 } = {},
): Promise<Uint8Array> {
  const bytes = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: fill, g: fill, b: fill },
    },
  })
    .jpeg()
    .toBuffer();
  return new Uint8Array(bytes);
}

/**
 * A PDF shaped like a phone document scan: one page per JPEG, each page drawing only that
 * image, embedded byte for byte as a `DCTDecode` stream.
 */
export async function scannedPdf(
  jpegs: Uint8Array[],
  { rotate = 0 }: { rotate?: number } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await PDFDocument.create();
  for (const jpeg of jpegs) {
    const image = await pdf.embedJpg(jpeg);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0 });
    if (rotate) page.setRotation(degrees(rotate));
  }
  return new Uint8Array(await pdf.save());
}

/** A PDF of text alone, as a word processor exports. */
export async function textPdf(): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([200, 100]).drawText('Not a scan', { x: 10, y: 50, font });
  return new Uint8Array(await pdf.save());
}

/** A PDF whose page draws a lossless (Flate) PNG image instead of a JPEG. */
export async function pngPdf(): Promise<Uint8Array<ArrayBuffer>> {
  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: '#808080' },
  })
    .png()
    .toBuffer();
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(new Uint8Array(png));
  pdf.addPage([4, 4]).drawImage(image, { x: 0, y: 0 });
  return new Uint8Array(await pdf.save());
}
