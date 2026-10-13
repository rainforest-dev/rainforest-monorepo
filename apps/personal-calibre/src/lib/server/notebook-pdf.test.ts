import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { notebookPdf } from './notebook-pdf';

async function collect(chunks: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const parts: Uint8Array[] = [];
  for await (const chunk of chunks) parts.push(chunk);
  return Buffer.concat(parts);
}

const image = (width: number, height: number, format: 'jpeg' | 'png') =>
  sharp({ create: { width, height, channels: 3, background: '#336699' } })
    .toFormat(format)
    .toBuffer();

describe('notebookPdf', () => {
  it('writes one page per stored image, skipping missing files, with a valid xref', async () => {
    const files = new Map<number, { data: Uint8Array; mimeType: string }>([
      [1, { data: await image(300, 400, 'jpeg'), mimeType: 'image/jpeg' }],
      // A page stored before uploads were normalised is converted on the way out.
      [3, { data: await image(500, 250, 'png'), mimeType: 'image/png' }],
    ]);
    const pdf = await collect(
      notebookPdf({
        title: '2026 手帳 A5',
        pages: [{ id: 1 }, { id: 2 }, { id: 3 }],
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
});
