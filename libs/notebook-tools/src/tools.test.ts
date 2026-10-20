import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { type Mock, vi } from 'vitest';
import { z } from 'zod';

import type { NotebookToolApi } from './api';
import {
  MAX_PAGES_PER_CALL,
  NOTEBOOK_TOOL_DEFINITIONS,
  notebookTools,
} from './tools';

const NOTEBOOK_ID = 5;
const PAGE_COUNT = 12;

const NOTEBOOK = {
  id: NOTEBOOK_ID,
  name: 'Field Log',
  status: 'active',
  startedOn: '2026-01-01',
  endedOn: null,
  createdAt: '2026-01-01 00:00:00',
  pageCount: PAGE_COUNT,
  coverPageId: 501,
};

const notebookPage = (position: number) => ({
  id: 500 + position,
  notebookId: NOTEBOOK_ID,
  position,
  pageNumber: position,
  pageDate: null,
  fileName: `page-${position}.png`,
  mimeType: 'image/png',
  bytes: 3,
  transcription: position === 1 ? '• tidy the desk' : null,
  transcribedAt: null,
  transcribedBy: null,
  source: 'upload',
  createdAt: '2026-01-02 00:00:00',
});

type FakeNotebookApi = Record<keyof NotebookToolApi, Mock>;

function fakeNotebookApi(): FakeNotebookApi {
  return {
    listNotebooks: vi.fn(async () => [NOTEBOOK]),
    getNotebookPages: vi.fn(
      async (
        id: number,
        { from = 1, to = PAGE_COUNT, limit = PAGE_COUNT } = {},
      ) =>
        id === NOTEBOOK_ID
          ? Array.from({ length: PAGE_COUNT }, (_, i) => notebookPage(i + 1))
              .filter((page) => page.position >= from && page.position <= to)
              .slice(0, limit)
          : null,
    ),
    readPageFile: vi.fn(async (id: number) => ({
      data: Buffer.from(`img${id}`),
      mimeType: 'image/png',
      fileName: `${id}.png`,
    })),
    setPageTranscription: vi.fn(
      async (
        id: number,
        input: {
          transcription: string;
          pageNumber?: number;
          pageDate?: string;
        },
      ) =>
        id === 501
          ? { ...notebookPage(1), ...input, transcribedAt: '2026-10-12' }
          : null,
    ),
    renameNotebook: vi.fn(async (id: number, name: string) =>
      id === NOTEBOOK_ID ? { ...NOTEBOOK, name } : null,
    ),
    reorderPages: vi.fn(async (id: number, pageIds: number[]) =>
      id === NOTEBOOK_ID
        ? { notebookId: id, before: [...pageIds].sort(), after: pageIds }
        : null,
    ),
    movePages: vi.fn(async (pageIds: number[], toNotebookId: number) => ({
      dryRun: false,
      moved: pageIds,
      dropped: [],
      target: { notebookId: toNotebookId, before: [], after: pageIds },
      sources: [],
    })),
    mergeNotebooks: vi.fn(async (sourceId: number, targetId: number) => ({
      dryRun: false,
      moved: [],
      dropped: [],
      target: { notebookId: targetId, before: [], after: [] },
      sources: [],
      deletedNotebookId: sourceId,
    })),
    deleteNotebook: vi.fn(async (id: number) =>
      id === NOTEBOOK_ID
        ? { dryRun: false, notebookId: id, deletedPageIds: [] }
        : null,
    ),
  };
}

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
  list_notebook_pages: {
    annotations: READ,
    input: ['notebookId'],
    required: ['notebookId'],
  },
  rename_notebook: {
    annotations: write(false, true),
    input: ['notebookId', 'name'],
    required: ['notebookId', 'name'],
  },
  reorder_pages: {
    annotations: write(false, true),
    input: ['notebookId', 'pageIds', 'dryRun'],
    required: ['notebookId', 'pageIds'],
  },
  move_pages: {
    annotations: write(true, false),
    input: ['pageIds', 'toNotebookId', 'beforePageId', 'afterPageId', 'dryRun'],
    required: ['pageIds', 'toNotebookId'],
  },
  merge_notebooks: {
    annotations: write(true, false),
    input: ['sourceNotebookId', 'targetNotebookId', 'placement', 'dryRun'],
    required: ['sourceNotebookId', 'targetNotebookId'],
  },
  delete_notebook: {
    annotations: write(true, true),
    input: ['notebookId', 'deletePages', 'dryRun'],
    required: ['notebookId'],
  },
};

const tools = notebookTools(fakeNotebookApi() as unknown as NotebookToolApi);

describe('notebook tool definitions', () => {
  it('keeps the existing tool names', () => {
    expect(tools.map((t) => t.name)).toEqual(Object.keys(EXPECTED));
  });

  it.each(tools.map((t) => [t.name, t] as const))(
    '%s has its inputs and annotations',
    (name, tool) => {
      const expected = EXPECTED[name];
      expect(tool.annotations).toEqual(expected?.annotations);
      expect(Object.keys(tool.input)).toEqual(expected?.input);
      const required = Object.entries(tool.input)
        .filter(([, schema]) => !z.safeParse(schema, undefined).success)
        .map(([key]) => key);
      expect(required).toEqual(expected?.required);
    },
  );

  it('describes the same tools without a store, for forwarding', async () => {
    expect(NOTEBOOK_TOOL_DEFINITIONS.map((t) => t.name)).toEqual(
      tools.map((t) => t.name),
    );
    await expect(NOTEBOOK_TOOL_DEFINITIONS[0]?.run({}, {})).rejects.toThrow(
      /only forward/,
    );
  });
});

describe('notebook tools', () => {
  type Block =
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string };

  const run = async (name: string, input: Record<string, unknown>) => {
    const library = fakeNotebookApi();
    const tool = notebookTools(library as unknown as NotebookToolApi).find(
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
    const library = fakeNotebookApi();
    library.readPageFile.mockResolvedValueOnce(null);
    const tool = notebookTools(library as unknown as NotebookToolApi).find(
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

describe('notebook organising tools', () => {
  const run = async (name: string, input: Record<string, unknown>) => {
    const library = fakeNotebookApi();
    const tool = notebookTools(library as unknown as NotebookToolApi).find(
      (t) => t.name === name,
    );
    const parsed = z.object(tool?.input ?? {}).parse(input);
    return { library, result: await tool?.run(parsed, {}) };
  };

  it('lists pages without images, with a one-line transcription preview', async () => {
    const { result } = await run('list_notebook_pages', {
      notebookId: NOTEBOOK_ID,
    });
    const pages = result as Array<Record<string, unknown>>;
    expect(pages).toHaveLength(12);
    expect(pages[0]).toEqual({
      id: 501,
      position: 1,
      pageNumber: 1,
      pageDate: null,
      fileName: 'page-1.png',
      transcription: '• tidy the desk',
    });
  });

  it('passes dryRun through and defaults it to false', async () => {
    const { library } = await run('move_pages', {
      pageIds: [501],
      toNotebookId: 6,
      afterPageId: 601,
    });
    expect(library.movePages).toHaveBeenCalledWith([501], 6, {
      afterPageId: 601,
      dryRun: false,
    });
    const merged = await run('merge_notebooks', {
      sourceNotebookId: 7,
      targetNotebookId: NOTEBOOK_ID,
      dryRun: true,
    });
    expect(merged.library.mergeNotebooks).toHaveBeenCalledWith(7, NOTEBOOK_ID, {
      placement: 'end',
      dryRun: true,
    });
  });

  it.each([
    ['list_notebook_pages', { notebookId: 999 }],
    ['rename_notebook', { notebookId: 999, name: 'x' }],
    ['reorder_pages', { notebookId: 999, pageIds: [1] }],
    ['delete_notebook', { notebookId: 999 }],
  ])('%s reports an unknown notebook', async (name, input) => {
    await expect(run(name, input)).rejects.toThrow(/Notebook 999 not found/);
  });
});
