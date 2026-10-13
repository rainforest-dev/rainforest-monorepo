import sharp from 'sharp';

import type { NotebookPage } from '@/types';

import { normalizePageImage } from './page-image';

/** Long edge of an exported page, in PDF points: the height of A4. */
const PAGE_LONG_EDGE = 842;

interface PdfImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/** A stored page as an upright RGB JPEG a PDF can embed byte for byte. */
async function pdfImage(data: Uint8Array, mimeType: string): Promise<PdfImage> {
  if (mimeType === 'image/jpeg') {
    const meta = await sharp(data).metadata();
    const embeddable =
      meta.space === 'srgb' &&
      meta.channels === 3 &&
      (meta.orientation ?? 1) === 1 &&
      meta.width !== undefined &&
      meta.height !== undefined;
    if (embeddable)
      return { bytes: data, width: meta.width, height: meta.height };
  }
  // Pages stored before uploads were normalised, or a JPEG a PDF would show sideways.
  return normalizePageImage(data, mimeType);
}

const encoder = new TextEncoder();

/** A PDF text string, as UTF-16BE hex so any notebook name survives. */
function pdfText(value: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < value.length; i++) {
    hex += value.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  }
  return `<${hex}>`;
}

export interface NotebookPdfSource {
  title: string;
  pages: readonly Pick<NotebookPage, 'id'>[];
  /** Reads a page's stored image; `null` when the file is gone, and the page is left out. */
  readPage: (
    pageId: number,
  ) => Promise<{ data: Uint8Array; mimeType: string } | null>;
}

interface ReadablePage {
  index: number;
  image: PdfImage;
}

/**
 * The first page at or after `from` whose image can be read and embedded. A page whose file is
 * gone, or whose bytes are not a readable image, is skipped rather than failing the export.
 */
async function nextReadablePage(
  { pages, readPage }: NotebookPdfSource,
  from: number,
): Promise<ReadablePage | null> {
  for (let index = from; index < pages.length; index++) {
    try {
      const stored = await readPage(pages[index].id);
      if (!stored) continue;
      return { index, image: await pdfImage(stored.data, stored.mimeType) };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Writes a notebook as a PDF, one page per readable scan in order, streaming one image at a time
 * so a thick notebook never sits in memory whole. Nothing is stored: the PDF is built per
 * request. Resolves to `null`, before anything is written, when no page can be read at all.
 */
export async function notebookPdf(
  source: NotebookPdfSource,
): Promise<AsyncGenerator<Uint8Array> | null> {
  const first = await nextReadablePage(source, 0);
  return first ? writePdf(source, first) : null;
}

async function* writePdf(
  source: NotebookPdfSource,
  first: ReadablePage,
): AsyncGenerator<Uint8Array> {
  let offset = 0;
  const offsets: number[] = [];
  const emit = (chunk: string | Uint8Array): Uint8Array => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
    offset += bytes.byteLength;
    return bytes;
  };
  const begin = (objectNumber: number) => {
    offsets[objectNumber] = offset;
    return emit(`${objectNumber} 0 obj\n`);
  };

  // Objects 1-3 are the catalog, the page tree and the info dictionary; pages follow.
  yield emit('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  yield begin(1);
  yield emit('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const kids: number[] = [];
  let next = 4;
  for (
    let page: ReadablePage | null = first;
    page;
    page = await nextReadablePage(source, page.index + 1)
  ) {
    const { image } = page;
    const scale = PAGE_LONG_EDGE / Math.max(image.width, image.height);
    const w = (image.width * scale).toFixed(2);
    const h = (image.height * scale).toFixed(2);
    const [pageObj, contentObj, imageObj] = [next, next + 1, next + 2];
    next += 3;
    kids.push(pageObj);

    yield begin(pageObj);
    yield emit(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`,
    );
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    yield begin(contentObj);
    yield emit(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
    );
    yield begin(imageObj);
    yield emit(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.byteLength} >>\nstream\n`,
    );
    yield emit(image.bytes);
    yield emit('\nendstream\nendobj\n');
  }

  yield begin(2);
  yield emit(
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>\nendobj\n`,
  );
  yield begin(3);
  yield emit(
    `<< /Title ${pdfText(source.title)} /Producer (personal-calibre) >>\nendobj\n`,
  );

  const xref = offset;
  let table = `xref\n0 ${next}\n0000000000 65535 f \n`;
  for (let n = 1; n < next; n++) {
    table += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  yield emit(table);
  yield emit(
    `trailer\n<< /Size ${next} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
}
