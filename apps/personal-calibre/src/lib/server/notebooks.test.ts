import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { createCalibreDb } from '@/test';

import {
  appendPages,
  checkPageUpload,
  createNotebook,
  deletePage,
  findOrCreateNotebookByName,
  getNotebook,
  getNotebookPages,
  listNotebooks,
  MAX_PAGE_BYTES,
  type PageUpload,
  readPageFile,
  readPageUploads,
  resolvePageMimeType,
  setPageTranscription,
} from './notebooks';

let notebooksRoot: string;

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'calibre-notebooks-'));
  notebooksRoot = path.join(dir, 'pages');
  process.env.CALIBRE_LIBRARY_PATH = createCalibreDb({
    authors: [],
    series: [],
    tags: [],
    books: [],
  });
  process.env.CALIBRE_APP_DB_PATH = path.join(dir, 'app.db');
  process.env.CALIBRE_NOTEBOOKS_DIR = notebooksRoot;
});

const png = (name: string, fill: number): PageUpload => ({
  name,
  type: 'image/png',
  bytes: new Uint8Array(16).fill(fill),
});

describe('resolvePageMimeType', () => {
  it.each([
    ['page.jpg', 'image/jpeg', 'image/jpeg'],
    ['IMG_0001.HEIC', 'image/heic', 'image/heic'],
    ['page.webp', '', 'image/webp'],
    ['page.jpeg', 'application/octet-stream', 'image/jpeg'],
    ['page.pdf', 'application/pdf', null],
    ['page.gif', 'image/gif', null],
    ['page.png', 'text/plain', null],
  ])('%s declared as %j resolves to %j', (name, type, expected) => {
    expect(resolvePageMimeType(name, type)).toBe(expected);
  });
});

describe('checkPageUpload', () => {
  it('refuses a PDF with 415 and says why', () => {
    const check = checkPageUpload({
      name: 'week.pdf',
      type: 'application/pdf',
      size: 10,
    });
    expect(check).toMatchObject({ ok: false, status: 415 });
    expect(!check.ok && check.message).toMatch(/PDF uploads are not supported/);
  });

  it('refuses a file over 25 MB with 413', () => {
    expect(
      checkPageUpload({
        name: 'big.jpg',
        type: 'image/jpeg',
        size: MAX_PAGE_BYTES + 1,
      }),
    ).toMatchObject({ ok: false, status: 413 });
  });
});

describe('readPageUploads', () => {
  it('requires at least one file', async () => {
    expect(await readPageUploads(new FormData())).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('refuses the whole form when one file is a PDF', async () => {
    const form = new FormData();
    form.append(
      'file',
      new File([new Uint8Array(4)], 'a.png', { type: 'image/png' }),
    );
    form.append(
      'file',
      new File([new Uint8Array(4)], 'b.pdf', { type: 'application/pdf' }),
    );
    expect(await readPageUploads(form)).toMatchObject({
      ok: false,
      status: 415,
    });
  });
});

describe('notebooks', () => {
  it('creates a notebook and refuses a duplicate name', async () => {
    const notebook = await createNotebook('  Field Log 2026  ');
    expect(notebook).toMatchObject({
      name: 'Field Log 2026',
      status: 'active',
    });
    await expect(createNotebook('Field Log 2026')).rejects.toThrow(
      /already exists/,
    );
    await expect(createNotebook('   ')).rejects.toThrow(/required/);
  });

  it('finds an existing notebook by name or creates it', async () => {
    const first = await findOrCreateNotebookByName('Pocket Ledger');
    const again = await findOrCreateNotebookByName(' Pocket Ledger ');
    expect(again.id).toBe(first.id);
  });

  it('appends pages in order, stores files and skips duplicates', async () => {
    const notebook = await createNotebook('Append Test');
    const first = await appendPages(
      notebook.id,
      [png('a.png', 1), png('b.png', 2)],
      'upload',
    );
    expect(first.added).toHaveLength(2);
    expect(first.skipped).toEqual([]);

    const second = await appendPages(notebook.id, [
      png('b-again.png', 2),
      png('c.png', 3),
      png('c-twice.png', 3),
    ]);
    expect(second.added).toHaveLength(1);
    expect(second.skipped.map((s) => s.name)).toEqual([
      'b-again.png',
      'c-twice.png',
    ]);

    const detail = await getNotebook(notebook.id);
    expect(detail?.pages.map((p) => [p.fileName, p.position])).toEqual([
      ['a.png', 1],
      ['b.png', 2],
      ['c.png', 3],
    ]);
    expect(detail?.pages[0]).toMatchObject({
      mimeType: 'image/png',
      bytes: 16,
      source: 'upload',
    });
    expect(detail?.coverPageId).toBe(first.added[0]);

    const pageId = first.added[0];
    expect(
      fs.existsSync(
        path.join(notebooksRoot, String(notebook.id), `${pageId}.png`),
      ),
    ).toBe(true);
    const file = await readPageFile(pageId);
    expect(file?.mimeType).toBe('image/png');
    expect([...(file?.data ?? [])]).toEqual(new Array(16).fill(1));
  });

  it('skips a file that fails the upload checks', async () => {
    const notebook = await createNotebook('Skip Test');
    const result = await appendPages(notebook.id, [
      { name: 'scan.pdf', type: 'application/pdf', bytes: new Uint8Array(4) },
    ]);
    expect(result.added).toEqual([]);
    expect(result.skipped[0]?.reason).toMatch(/PDF/);
  });

  it('refuses to append to a missing notebook', async () => {
    await expect(appendPages(9999, [png('x.png', 9)])).rejects.toThrow(
      /not found/,
    );
  });

  it('lists notebooks with page counts and covers', async () => {
    const notebook = await createNotebook('List Test');
    const { added } = await appendPages(notebook.id, [
      png('l1.png', 11),
      png('l2.png', 12),
    ]);
    const listed = (await listNotebooks()).find((n) => n.id === notebook.id);
    expect(listed).toMatchObject({ pageCount: 2, coverPageId: added[0] });
    const empty = (await listNotebooks()).find(
      (n) => n.name === 'Pocket Ledger',
    );
    expect(empty).toMatchObject({ pageCount: 0, coverPageId: null });
  });

  it('pages a notebook by position', async () => {
    const notebook = await createNotebook('Range Test');
    await appendPages(
      notebook.id,
      Array.from({ length: 5 }, (_, i) => png(`r${i}.png`, 40 + i)),
    );
    const pages = await getNotebookPages(notebook.id, { from: 2, to: 4 });
    expect(pages?.map((p) => p.position)).toEqual([2, 3, 4]);
    const capped = await getNotebookPages(notebook.id, { limit: 2 });
    expect(capped?.map((p) => p.position)).toEqual([1, 2]);
    expect(await getNotebookPages(9999)).toBeNull();
  });

  it('sets a transcription and keeps unspecified fields', async () => {
    const notebook = await createNotebook('Transcription Test');
    const [pageId] = (await appendPages(notebook.id, [png('t.png', 60)])).added;

    const first = await setPageTranscription(pageId, {
      transcription: '• water the ferns',
      pageNumber: 12,
      pageDate: '2026-03-04',
    });
    expect(first).toMatchObject({
      transcription: '• water the ferns',
      pageNumber: 12,
      pageDate: '2026-03-04',
    });
    expect(first?.transcribedAt).toBeTruthy();

    const second = await setPageTranscription(pageId, {
      transcription: '× water the ferns',
    });
    expect(second).toMatchObject({ pageNumber: 12, pageDate: '2026-03-04' });
    expect(
      await setPageTranscription(9999, { transcription: 'nothing' }),
    ).toBeNull();
  });

  it('deletes a page and its file, and appends after the last position', async () => {
    const notebook = await createNotebook('Delete Test');
    const { added } = await appendPages(notebook.id, [
      png('d1.png', 70),
      png('d2.png', 71),
    ]);
    expect(await deletePage(added[1])).toBe(true);
    expect(await deletePage(added[1])).toBe(false);
    expect(await readPageFile(added[1])).toBeNull();
    expect(
      fs.existsSync(
        path.join(notebooksRoot, String(notebook.id), `${added[1]}.png`),
      ),
    ).toBe(false);

    await appendPages(notebook.id, [png('d3.png', 72)]);
    const detail = await getNotebook(notebook.id);
    expect(detail?.pages.map((p) => p.position)).toEqual([1, 2]);
  });
});
