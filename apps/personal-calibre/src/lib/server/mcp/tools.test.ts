import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { fakeLibrary, NOTEBOOK_ID } from './testing';
import {
  addDeliveryInputSchema,
  type CalibreLibrary,
  calibreTools,
  MAX_PAGES_PER_CALL,
} from './tools';

const READ: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
const write = (destructive: boolean, idempotent: boolean): ToolAnnotations => ({
  readOnlyHint: false,
  destructiveHint: destructive,
  idempotentHint: idempotent,
  openWorldHint: false,
});

const EXPECTED: Record<
  string,
  { annotations: ToolAnnotations; input: string[]; required: string[] }
> = {
  list_books: {
    annotations: READ,
    input: [
      'query',
      'authorId',
      'tagId',
      'seriesId',
      'platformKey',
      'delivered',
      'groupBy',
      'sortBy',
      'sortDir',
      'page',
      'limit',
    ],
    required: [],
  },
  get_book: { annotations: READ, input: ['bookId'], required: ['bookId'] },
  list_undelivered_books: {
    annotations: READ,
    input: ['platformKey', 'page', 'limit'],
    required: ['platformKey'],
  },
  list_deliveries: {
    annotations: READ,
    input: ['bookId'],
    required: ['bookId'],
  },
  add_delivery: {
    annotations: write(false, false),
    input: ['bookId', 'platformKey', 'externalRef', 'note'],
    required: ['bookId', 'platformKey'],
  },
  bulk_add_delivery: {
    annotations: write(false, false),
    input: ['bookIds', 'platformKey', 'note'],
    required: ['bookIds', 'platformKey'],
  },
  remove_delivery: {
    annotations: write(true, true),
    input: ['bookId', 'deliveryId'],
    required: ['bookId', 'deliveryId'],
  },
  list_tags: { annotations: READ, input: [], required: [] },
  add_tag: {
    annotations: write(false, true),
    input: ['bookId', 'tagName'],
    required: ['bookId', 'tagName'],
  },
  remove_tag: {
    annotations: write(true, true),
    input: ['bookId', 'tagId'],
    required: ['bookId', 'tagId'],
  },
  list_notebooks: { annotations: READ, input: [], required: [] },
  get_notebook_pages: {
    annotations: READ,
    input: ['notebookId', 'fromPosition', 'toPosition'],
    required: ['notebookId'],
  },
  set_page_transcription: {
    annotations: write(false, true),
    input: ['pageId', 'transcription', 'pageNumber', 'pageDate'],
    required: ['pageId', 'transcription'],
  },
};

const tools = calibreTools(fakeLibrary() as unknown as CalibreLibrary);

describe('calibre MCP tools', () => {
  it('keeps the existing tool names', () => {
    expect(tools.map((t) => t.name)).toEqual(Object.keys(EXPECTED));
  });

  it.each(tools.map((t) => [t.name, t] as const))(
    '%s has its inputs and annotations',
    (name, tool) => {
      const expected = EXPECTED[name];
      expect(tool.annotations).toEqual(expected.annotations);
      expect(Object.keys(tool.input)).toEqual(expected.input);
      const required = Object.entries(tool.input)
        .filter(([, schema]) => !z.safeParse(schema, undefined).success)
        .map(([key]) => key);
      expect(required).toEqual(expected.required);
    },
  );

  it('defaults paging on list_books', () => {
    const listBooks = tools.find((t) => t.name === 'list_books');
    expect(z.object(listBooks?.input ?? {}).parse({})).toEqual({
      page: 1,
      limit: 30,
    });
  });

  it.each([
    [{ page: 0 }],
    [{ limit: 101 }],
    [{ groupBy: 'publisher' }],
    [{ authorId: 1.5 }],
  ])('rejects list_books input %j', (input) => {
    const listBooks = tools.find((t) => t.name === 'list_books');
    expect(z.object(listBooks?.input ?? {}).safeParse(input).success).toBe(
      false,
    );
  });

  it('rejects an empty tag name', () => {
    const addTag = tools.find((t) => t.name === 'add_tag');
    expect(
      z.object(addTag?.input ?? {}).safeParse({ bookId: 1, tagName: '' })
        .success,
    ).toBe(false);
  });
});

describe('add_delivery input schema', () => {
  const schema = z.object(addDeliveryInputSchema);

  it.each([
    [{ bookId: 1, platformKey: 'kobo' }, true],
    [
      {
        bookId: 1,
        platformKey: 'kobo',
        externalRef: 'https://example.com/shelf/41',
      },
      true,
    ],
    [
      { bookId: 1, platformKey: 'kobo', externalRef: 'javascript:alert(1)' },
      false,
    ],
    [
      {
        bookId: 1,
        platformKey: 'kobo',
        externalRef: 'data:text/html,<script>alert(1)</script>',
      },
      false,
    ],
    [{ bookId: 1, platformKey: 'kobo', externalRef: 'not a url' }, false],
  ])('parses %j as %s', (input, ok) => {
    expect(schema.safeParse(input).success).toBe(ok);
  });
});

describe('notebook tools', () => {
  type Block =
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string };

  const run = async (name: string, input: Record<string, unknown>) => {
    const library = fakeLibrary();
    const tool = calibreTools(library as unknown as CalibreLibrary).find(
      (t) => t.name === name,
    );
    const parsed = z.object(tool?.input ?? {}).parse(input);
    return { library, result: await tool?.run(parsed, {}) };
  };

  const blocksOf = (result: unknown): Block[] =>
    (result as { content: Block[] }).content;

  it('lists notebooks with only id, name, status and pageCount', async () => {
    const { result } = await run('list_notebooks', {});
    expect(result).toEqual([
      { id: NOTEBOOK_ID, name: 'Field Log', status: 'active', pageCount: 12 },
    ]);
  });

  it(`returns at most ${MAX_PAGES_PER_CALL} pages as images with their metadata`, async () => {
    const { library, result } = await run('get_notebook_pages', {
      notebookId: NOTEBOOK_ID,
    });
    const blocks = blocksOf(result);
    expect(JSON.parse((blocks[0] as { text: string }).text)).toEqual({
      notebookId: NOTEBOOK_ID,
      pages: MAX_PAGES_PER_CALL,
      nextPosition: MAX_PAGES_PER_CALL + 1,
    });
    const images = blocks.filter((b) => b.type === 'image');
    expect(images).toHaveLength(MAX_PAGES_PER_CALL);
    expect(images[0]).toEqual({
      type: 'image',
      data: Buffer.from('img501').toString('base64'),
      mimeType: 'image/png',
    });
    expect(JSON.parse((blocks[1] as { text: string }).text)).toEqual({
      id: 501,
      position: 1,
      pageNumber: 1,
      pageDate: null,
      transcription: '• tidy the desk',
    });
    expect(library.getNotebookPages).toHaveBeenCalledWith(NOTEBOOK_ID, {
      from: 1,
      to: undefined,
      limit: MAX_PAGES_PER_CALL + 1,
    });
  });

  it('honours a position range and reports no next page at the end', async () => {
    const { result } = await run('get_notebook_pages', {
      notebookId: NOTEBOOK_ID,
      fromPosition: 11,
      toPosition: 20,
    });
    const blocks = blocksOf(result);
    expect(JSON.parse((blocks[0] as { text: string }).text)).toMatchObject({
      pages: 2,
      nextPosition: null,
    });
  });

  it('marks a page whose image is missing', async () => {
    const library = fakeLibrary();
    library.readPageFile.mockResolvedValueOnce(null);
    const tool = calibreTools(library as unknown as CalibreLibrary).find(
      (t) => t.name === 'get_notebook_pages',
    );
    const blocks = blocksOf(
      await tool?.run({ notebookId: NOTEBOOK_ID, toPosition: 1 }, {}),
    );
    expect(blocks.map((b) => b.type)).toEqual(['text', 'text']);
    expect(JSON.parse((blocks[1] as { text: string }).text)).toMatchObject({
      image: 'missing',
    });
  });

  it.each([
    [{ notebookId: 999 }, /Notebook 999 not found/],
    [
      { notebookId: NOTEBOOK_ID, fromPosition: 5, toPosition: 4 },
      /toPosition must not be before fromPosition/,
    ],
  ])('rejects %j', async (input, message) => {
    await expect(run('get_notebook_pages', input)).rejects.toThrow(message);
  });

  it('saves a transcription', async () => {
    const { library, result } = await run('set_page_transcription', {
      pageId: 501,
      transcription: '× tidy the desk',
      pageDate: '2026-01-02',
    });
    expect(result).toEqual({
      ok: true,
      pageId: 501,
      pageNumber: 1,
      pageDate: '2026-01-02',
    });
    expect(library.setPageTranscription).toHaveBeenCalledWith(501, {
      transcription: '× tidy the desk',
      pageDate: '2026-01-02',
    });
    await expect(
      run('set_page_transcription', { pageId: 9, transcription: 'x' }),
    ).rejects.toThrow(/Page 9 not found/);
  });

  it.each([
    [{ pageId: 1, transcription: 'x', pageDate: '2026-13-01' }],
    [{ pageId: 1, transcription: 'x', pageDate: '02/01/2026' }],
    [{ pageId: 1, transcription: 'x', pageNumber: 0 }],
    [{ pageId: 1 }],
  ])('rejects set_page_transcription input %j', (input) => {
    const tool = tools.find((t) => t.name === 'set_page_transcription');
    expect(z.object(tool?.input ?? {}).safeParse(input).success).toBe(false);
  });
});
