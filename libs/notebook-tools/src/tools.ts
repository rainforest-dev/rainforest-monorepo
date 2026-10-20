import {
  defineTool,
  type McpTool,
  toolContent,
  ToolInputError,
} from '@rainforest-dev/mcp-kit';
import { z } from 'zod';

import type { NotebookToolApi } from './api';

/** The most pages `get_notebook_pages` returns in one call, since each carries its image. */
export const MAX_PAGES_PER_CALL = 10;

const READ = { readOnlyHint: true, openWorldHint: false } as const;

const position = () => z.number().int().min(1);
const id = () => z.number().int().min(1);
const dryRun = () =>
  z
    .boolean()
    .default(false)
    .describe('Return the resulting order without changing anything');

const write = (destructive: boolean, idempotent: boolean) =>
  ({
    readOnlyHint: false,
    destructiveHint: destructive,
    idempotentHint: idempotent,
    openWorldHint: false,
  }) as const;

/** First line of a transcription, enough to tell pages apart when planning an order. */
const preview = (text: string | null) => {
  const line = text?.trim().split('\n')[0] ?? null;
  return line && line.length > 80 ? `${line.slice(0, 79)}…` : line;
};

/**
 * The notebook MCP tools. personal-notebook runs them against its DB; personal-calibre lists the
 * same definitions and forwards each call to personal-notebook, so existing clients keep one
 * server.
 */
export const notebookTools = (api: NotebookToolApi): McpTool[] => [
  defineTool({
    name: 'list_notebooks',
    title: 'List notebooks',
    description:
      'List the scanned paper Bullet Journal notebooks, active first, with their page counts.',
    input: {},
    annotations: READ,
    run: async () =>
      (await api.listNotebooks()).map(({ id, name, status, pageCount }) => ({
        id,
        name,
        status,
        pageCount,
      })),
  }),

  defineTool({
    name: 'get_notebook_pages',
    title: 'Get notebook pages',
    description: `Read scanned pages of a notebook in order, each as its image plus any saved transcription. Returns at most ${MAX_PAGES_PER_CALL} pages per call; when more remain, the first text block names nextPosition to pass as fromPosition.`,
    input: {
      notebookId: z.number().int(),
      fromPosition: position().optional().describe('First position, default 1'),
      toPosition: position().optional().describe('Last position, inclusive'),
    },
    annotations: READ,
    run: async ({ notebookId, fromPosition = 1, toPosition }) => {
      if (toPosition !== undefined && toPosition < fromPosition) {
        throw new ToolInputError('toPosition must not be before fromPosition');
      }
      const pages = await api.getNotebookPages(notebookId, {
        from: fromPosition,
        to: toPosition,
        limit: MAX_PAGES_PER_CALL + 1,
      });
      if (!pages) throw new ToolInputError(`Notebook ${notebookId} not found`);

      const shown = pages.slice(0, MAX_PAGES_PER_CALL);
      const nextPosition =
        pages.length > MAX_PAGES_PER_CALL
          ? pages[MAX_PAGES_PER_CALL].position
          : null;
      const content: Parameters<typeof toolContent>[0] = [
        {
          type: 'text',
          text: JSON.stringify({
            notebookId,
            pages: shown.length,
            nextPosition,
          }),
        },
      ];
      for (const page of shown) {
        const file = await api.readPageFile(page.id);
        content.push({
          type: 'text',
          text: JSON.stringify({
            id: page.id,
            position: page.position,
            pageNumber: page.pageNumber,
            pageDate: page.pageDate,
            transcription: page.transcription,
            ...(!file && { image: 'missing' }),
          }),
        });
        if (file) {
          content.push({
            type: 'image',
            data: file.data.toString('base64'),
            mimeType: file.mimeType,
          });
        }
      }
      return toolContent(content);
    },
  }),

  defineTool({
    name: 'set_page_transcription',
    title: 'Set page transcription',
    description:
      'Save the transcription of a notebook page, replacing any earlier one. pageNumber and pageDate are kept when omitted.',
    input: {
      pageId: z.number().int(),
      transcription: z.string(),
      pageNumber: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('The number printed on the page'),
      pageDate: z.iso
        .date()
        .optional()
        .describe('The date the page covers, YYYY-MM-DD'),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: async ({ pageId, ...input }) => {
      const page = await api.setPageTranscription(pageId, input);
      if (!page) throw new ToolInputError(`Page ${pageId} not found`);
      return {
        ok: true,
        pageId,
        pageNumber: page.pageNumber,
        pageDate: page.pageDate,
      };
    },
  }),
  defineTool({
    name: 'list_notebook_pages',
    title: 'List notebook pages',
    description:
      'List every page of a notebook in order, without images: id, position, pageNumber, pageDate, fileName and the first line of any transcription. Use it to plan a reorder, move or merge; act on page ids, which never change, not on positions, which do.',
    input: { notebookId: id() },
    annotations: READ,
    run: async ({ notebookId }) => {
      const pages = await api.getNotebookPages(notebookId);
      if (!pages) throw new ToolInputError(`Notebook ${notebookId} not found`);
      return pages.map((page) => ({
        id: page.id,
        position: page.position,
        pageNumber: page.pageNumber,
        pageDate: page.pageDate,
        fileName: page.fileName,
        transcription: preview(page.transcription),
      }));
    },
  }),

  defineTool({
    name: 'rename_notebook',
    title: 'Rename notebook',
    description:
      'Rename a notebook. A name another notebook already has is refused; use merge_notebooks to combine them.',
    input: { notebookId: id(), name: z.string().min(1).max(120) },
    annotations: write(false, true),
    run: async ({ notebookId, name }) => {
      const notebook = await api.renameNotebook(notebookId, name);
      if (!notebook)
        throw new ToolInputError(`Notebook ${notebookId} not found`);
      return { id: notebook.id, name: notebook.name };
    },
  }),

  defineTool({
    name: 'reorder_pages',
    title: 'Reorder pages',
    description:
      'Put the pages of a notebook in a new order. pageIds must list every page of the notebook exactly once (from list_notebook_pages); positions are renumbered from 1. Returns the order before and after.',
    input: {
      notebookId: id(),
      pageIds: z.array(id()).min(1),
      dryRun: dryRun(),
    },
    annotations: write(false, true),
    run: async ({ notebookId, pageIds, dryRun }) => {
      const change = await api.reorderPages(notebookId, pageIds, {
        dryRun,
      });
      if (!change) throw new ToolInputError(`Notebook ${notebookId} not found`);
      return { dryRun, ...change };
    },
  }),

  defineTool({
    name: 'move_pages',
    title: 'Move pages',
    description:
      'Move pages, in the order given, into a notebook: at the end, or before or after one of its pages. Pages may come from any notebooks, e.g. sorting Unsorted into the right notebooks. A page whose exact image the target already has is deleted instead and listed under dropped. Returns the order of every notebook touched, before and after. Try it with dryRun first.',
    input: {
      pageIds: z.array(id()).min(1),
      toNotebookId: id(),
      beforePageId: id().optional(),
      afterPageId: id().optional(),
      dryRun: dryRun(),
    },
    annotations: write(true, false),
    run: async ({ pageIds, toNotebookId, ...options }) =>
      api.movePages(pageIds, toNotebookId, options),
  }),

  defineTool({
    name: 'merge_notebooks',
    title: 'Merge notebooks',
    description:
      'Move every page of the source notebook to the start or end of the target, then delete the emptied source. Exact duplicate images are dropped as in move_pages. Try it with dryRun first.',
    input: {
      sourceNotebookId: id(),
      targetNotebookId: id(),
      placement: z.enum(['start', 'end']).default('end'),
      dryRun: dryRun(),
    },
    annotations: write(true, false),
    run: async ({ sourceNotebookId, targetNotebookId, placement, dryRun }) =>
      api.mergeNotebooks(sourceNotebookId, targetNotebookId, {
        placement,
        dryRun,
      }),
  }),

  defineTool({
    name: 'delete_notebook',
    title: 'Delete notebook',
    description:
      'Delete a notebook. One that still has pages is refused unless deletePages is true, which deletes its pages and images for good; move or merge pages you want to keep first.',
    input: {
      notebookId: id(),
      deletePages: z.boolean().default(false),
      dryRun: dryRun(),
    },
    annotations: write(true, true),
    run: async ({ notebookId, deletePages, dryRun }) => {
      const result = await api.deleteNotebook(notebookId, {
        deletePages,
        dryRun,
      });
      if (!result) throw new ToolInputError(`Notebook ${notebookId} not found`);
      return result;
    },
  }),
];

const forwardOnly = (): never => {
  throw new Error(
    'notebook tools here only forward; run them in personal-notebook',
  );
};

/**
 * The definitions alone, for a server that forwards the calls with `forwardTools` instead of
 * running them.
 */
export const NOTEBOOK_TOOL_DEFINITIONS: readonly McpTool[] = notebookTools({
  listNotebooks: forwardOnly,
  getNotebookPages: forwardOnly,
  readPageFile: forwardOnly,
  setPageTranscription: forwardOnly,
  renameNotebook: forwardOnly,
  reorderPages: forwardOnly,
  movePages: forwardOnly,
  mergeNotebooks: forwardOnly,
  deleteNotebook: forwardOnly,
});
