import fs from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { appendPages, createNotebook } from '@/lib/server';
import { pagePng, setUpNotebookShelf } from '@/test';

import { GET } from './route';

let pagesRoot: string;

beforeAll(() => {
  pagesRoot = setUpNotebookShelf('calibre-notebook-pdf-');
});

const get = (id: string | number) =>
  GET(new Request(`https://calibre.example.test/api/notebooks/${id}/pdf`), {
    params: Promise.resolve({ id: String(id) }),
  });

async function notebookWithPages(name: string, fills: number[]) {
  const notebook = await createNotebook(name);
  const { added } = await appendPages(
    notebook.id,
    await Promise.all(
      fills.map(async (fill) => ({
        name: `p${fill}.png`,
        type: 'image/png',
        bytes: await pagePng(fill),
      })),
    ),
  );
  return { id: notebook.id, added };
}

describe('GET /api/notebooks/[id]/pdf', () => {
  it.each(['abc', '0', '-3', '1.5'])('answers 400 to id %j', async (id) => {
    expect((await get(id)).status).toBe(400);
  });

  it('answers 404 for an unknown notebook', async () => {
    expect((await get(9999)).status).toBe(404);
  });

  it('answers 409 for a notebook with no pages', async () => {
    const { id } = await createNotebook('Blank');
    const response = await get(id);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/no pages/);
  });

  it('answers 409, before streaming, when no page image can be read', async () => {
    const { id, added } = await notebookWithPages('Lost Files', [10, 11]);
    // One file gone, the other no longer an image.
    fs.rmSync(path.join(pagesRoot, String(id), `${added[0]}.jpg`));
    fs.writeFileSync(
      path.join(pagesRoot, String(id), `${added[1]}.jpg`),
      'not a jpeg',
    );
    const response = await get(id);
    expect(response.status).toBe(409);
    expect(response.headers.get('content-type')).toMatch(/json/);
  });

  it('streams a PDF named after the notebook and its dates, CJK included', async () => {
    const { id } = await notebookWithPages('2026 手帳', [20, 21]);
    const response = await get(id);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    const disposition = response.headers.get('content-disposition') ?? '';
    const today = new Date().toISOString().slice(0, 10);
    expect(disposition).toContain(
      `attachment; filename="BuJo ${today} 2026 __.pdf"`,
    );
    expect(disposition).toContain(
      `filename*=UTF-8''${encodeURIComponent(`BuJo ${today} 2026 手帳.pdf`)}`,
    );

    const pdf = Buffer.from(await response.arrayBuffer()).toString('latin1');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toMatch(/\/Count 2/);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  });
});
