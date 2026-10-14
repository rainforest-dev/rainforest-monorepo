import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { notebookPdf, notebookPdfFileName } from './notebook-pdf';

async function collect(
  pending: Promise<AsyncIterable<Uint8Array> | null>,
): Promise<Buffer> {
  const chunks = await pending;
  if (!chunks) throw new Error('expected a PDF');
  const parts: Uint8Array[] = [];
  for await (const chunk of chunks) parts.push(chunk);
  return Buffer.concat(parts);
}

const image = (width: number, height: number, format: 'jpeg' | 'png') =>
  sharp({ create: { width, height, channels: 3, background: '#336699' } })
    .toFormat(format)
    .toBuffer();

describe('notebookPdf', () => {
  it('writes one page per stored image, skipping missing and unreadable files, with a valid xref', async () => {
    const files = new Map<number, { data: Uint8Array; mimeType: string }>([
      // Neither a JPEG nor any other image: left out like a missing file.
      [0, { data: new Uint8Array(64).fill(7), mimeType: 'image/jpeg' }],
      [1, { data: await image(300, 400, 'jpeg'), mimeType: 'image/jpeg' }],
      [2, { data: new Uint8Array([0x89, 0x50, 0x4e]), mimeType: 'image/png' }],
      // A page stored before uploads were normalised is converted on the way out.
      [3, { data: await image(500, 250, 'png'), mimeType: 'image/png' }],
    ]);
    const pdf = await collect(
      notebookPdf({
        title: '2026 手帳 A5',
        pages: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
        readPage: async (id) => files.get(id) ?? null,
      }),
    );
    const text = pdf.toString('latin1');

    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toMatch(/\/Type \/Pages \/Kids \[4 0 R 7 0 R\] \/Count 2/);
    expect(text).toContain('/MediaBox [0 0 631.50 842.00]');
    expect(text).toContain('/MediaBox [0 0 842.00 421.00]');
    expect(text).toContain('/Width 500 /Height 250');
    // The title is UTF-16BE, so a CJK name survives.
    expect(text).toContain(
      '/Title <FEFF00320030003200360020624B5E33002000410035>',
    );

    const startxref = Number(/startxref\n(\d+)\n/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = text
      .slice(startxref)
      .split('\n')
      .filter((line) => / 00000 n $/.test(line))
      .map((line) => Number(line.slice(0, 10)));
    expect(entries).toHaveLength(9);
    entries.forEach((at, i) => {
      expect(text.slice(at, at + 10)).toMatch(new RegExp(`^${i + 1} 0 obj`));
    });

    // Each image stream carries exactly the JPEG bytes its /Length declares.
    for (const match of text.matchAll(
      /\/DCTDecode \/Length (\d+) >>\nstream\n/g,
    )) {
      const start = match.index + match[0].length;
      const jpeg = pdf.subarray(start, start + Number(match[1]));
      expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
      expect([...jpeg.subarray(-2)]).toEqual([0xff, 0xd9]);
      expect(
        pdf.subarray(start + jpeg.length, start + jpeg.length + 10).toString(),
      ).toBe('\nendstream');
    }
  });

  it('resolves to null before writing anything when no page can be read', async () => {
    const reads: number[] = [];
    const pdf = await notebookPdf({
      title: 'Empty',
      pages: [{ id: 1 }, { id: 2 }, { id: 3 }],
      readPage: async (id) => {
        reads.push(id);
        if (id === 1) return null;
        if (id === 2) throw new Error('EACCES');
        return { data: new Uint8Array(16), mimeType: 'image/jpeg' };
      },
    });
    expect(pdf).toBeNull();
    expect(reads).toEqual([1, 2, 3]);
  });
});

describe('notebookPdfFileName', () => {
  const page = (createdAt: string) => ({ createdAt });
  const name = (
    notebook: Partial<Parameters<typeof notebookPdfFileName>[0]>,
  ): string =>
    notebookPdfFileName({
      name: '2026 Q3',
      startedOn: null,
      endedOn: null,
      pages: [],
      ...notebook,
    });

  it('names an archived notebook by its start and end dates', () => {
    expect(name({ startedOn: '2026-07-01', endedOn: '2026-10-14' })).toBe(
      'BuJo 2026-07-01_2026-10-14 2026 Q3.pdf',
    );
  });

  it('falls back to the first and last upload dates', () => {
    const pages = [
      page('2026-10-14 09:00:00'),
      page('2026-08-02 12:00:00'),
      page('2026-09-30 23:59:59'),
    ];
    expect(name({ pages })).toBe('BuJo 2026-08-02_2026-10-14 2026 Q3.pdf');
  });

  it('writes one date when the range is a single day', () => {
    expect(name({ pages: [page('2026-10-14 09:00:00')] })).toBe(
      'BuJo 2026-10-14 2026 Q3.pdf',
    );
  });

  it('keeps out characters a file system rejects', () => {
    expect(name({ name: 'Work/Home: A5', startedOn: '2026-01-01' })).toBe(
      'BuJo 2026-01-01 Work-Home- A5.pdf',
    );
  });
});
