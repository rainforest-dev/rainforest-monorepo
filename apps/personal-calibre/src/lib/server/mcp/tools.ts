import {
  defineTool,
  type McpTool,
  toolContent,
  ToolInputError,
} from '@rainforest-dev/mcp-kit';
import { z } from 'zod';

import type {
  bulkCreateDeliveryEvents,
  createBookDeliveryEvent,
  deleteBookDeliveryEvent,
  listBookDeliveryEvents,
} from '@/lib/server/delivery';
import type {
  deleteNotebook,
  getNotebookPages,
  listNotebooks,
  mergeNotebooks,
  movePages,
  readPageFile,
  renameNotebook,
  reorderPages,
  setPageTranscription,
} from '@/lib/server/notebooks';
import type {
  getBook,
  getBookList,
  getFilterOptions,
  getGroupedBookList,
  listUndeliveredBooks,
  searchBookList,
} from '@/lib/server/queries';
import type {
  addTagToBook,
  getOrCreateTag,
  removeTagFromBook,
  revalidateBookTagCache,
} from '@/lib/server/tags';
import { httpUrlSchema } from '@/lib/url';

export type CalibreLibrary = {
  getBookList: typeof getBookList;
  getGroupedBookList: typeof getGroupedBookList;
  searchBookList: typeof searchBookList;
  getBook: typeof getBook;
  listUndeliveredBooks: typeof listUndeliveredBooks;
  listBookDeliveryEvents: typeof listBookDeliveryEvents;
  createBookDeliveryEvent: typeof createBookDeliveryEvent;
  bulkCreateDeliveryEvents: typeof bulkCreateDeliveryEvents;
  deleteBookDeliveryEvent: typeof deleteBookDeliveryEvent;
  getFilterOptions: typeof getFilterOptions;
  getOrCreateTag: typeof getOrCreateTag;
  addTagToBook: typeof addTagToBook;
  removeTagFromBook: typeof removeTagFromBook;
  revalidateBookTagCache: typeof revalidateBookTagCache;
  listNotebooks: typeof listNotebooks;
  getNotebookPages: typeof getNotebookPages;
  readPageFile: typeof readPageFile;
  setPageTranscription: typeof setPageTranscription;
  renameNotebook: typeof renameNotebook;
  reorderPages: typeof reorderPages;
  movePages: typeof movePages;
  mergeNotebooks: typeof mergeNotebooks;
  deleteNotebook: typeof deleteNotebook;
};

const READ = { readOnlyHint: true, openWorldHint: false } as const;

const page = () => z.number().int().min(1).default(1);
const limit = () => z.number().int().min(1).max(100).default(30);

export const addDeliveryInputSchema = {
  bookId: z.number().int(),
  platformKey: z.string(),
  externalRef: httpUrlSchema.optional(),
  note: z.string().optional(),
};

/** The most pages `get_notebook_pages` returns in one call, since each carries its image. */
export const MAX_PAGES_PER_CALL = 10;

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

export const calibreTools = (library: CalibreLibrary): McpTool[] => [
  defineTool({
    name: 'list_books',
    title: 'List books',
    description:
      'Search and list books. The query is full-text plus semantic, ordered by relevance unless sortBy (with sortDir) is set, and lexical-only when the embedding service is unreachable; queries under 3 characters match by substring. When groupBy is set, returns { groups } with 6 preview books each; otherwise returns { books, total }. Both carry semantic ("on" | "off") and, when semantic search could not answer, reason.',
    input: {
      query: z.string().optional().describe('Full-text plus semantic search'),
      authorId: z.number().int().optional(),
      tagId: z.number().int().optional(),
      seriesId: z.number().int().optional(),
      platformKey: z
        .string()
        .optional()
        .describe('Platform key, e.g. "readwise-reader"'),
      delivered: z
        .boolean()
        .optional()
        .describe('true=delivered only, false=undelivered only'),
      groupBy: z.enum(['series', 'tag', 'author']).optional(),
      sortBy: z
        .enum(['title', 'author', 'pubdate', 'added', 'rating'])
        .optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      page: page(),
      limit: limit(),
    },
    annotations: READ,
    run: ({ query, ...params }) =>
      library.searchBookList({ q: query, ...params }),
  }),

  defineTool({
    name: 'get_book',
    title: 'Get book',
    description: 'Get full details for a single book',
    input: { bookId: z.number().int() },
    annotations: READ,
    run: async ({ bookId }) => {
      const book = await library.getBook(bookId);
      if (!book) throw new ToolInputError(`Book ${bookId} not found`);
      return book;
    },
  }),

  defineTool({
    name: 'list_undelivered_books',
    title: 'List undelivered books',
    description: 'List books not yet delivered to a platform',
    input: { platformKey: z.string(), page: page(), limit: limit() },
    annotations: READ,
    run: (input) => library.listUndeliveredBooks(input),
  }),

  defineTool({
    name: 'list_deliveries',
    title: 'List deliveries',
    description: 'Get delivery history for a book',
    input: { bookId: z.number().int() },
    annotations: READ,
    run: ({ bookId }) => library.listBookDeliveryEvents(bookId),
  }),

  defineTool({
    name: 'add_delivery',
    title: 'Add delivery',
    description: 'Record a book as delivered to a platform',
    input: addDeliveryInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    run: async ({ bookId, platformKey, externalRef, note }) => {
      await library.createBookDeliveryEvent(bookId, {
        platformKey,
        externalRef,
        note,
      });
      return { ok: true, bookId, platformKey };
    },
  }),

  defineTool({
    name: 'bulk_add_delivery',
    title: 'Add deliveries in bulk',
    description: 'Record multiple books as delivered to a platform',
    input: {
      bookIds: z.array(z.number().int()),
      platformKey: z.string(),
      note: z.string().optional(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    run: async ({ bookIds, platformKey, note }) => {
      const { count } = await library.bulkCreateDeliveryEvents(bookIds, {
        platformKey,
        note,
      });
      return { ok: true, count, platformKey };
    },
  }),

  defineTool({
    name: 'remove_delivery',
    title: 'Remove delivery',
    description: 'Remove a delivery record',
    input: { bookId: z.number().int(), deliveryId: z.number().int() },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: async ({ bookId, deliveryId }) => {
      await library.deleteBookDeliveryEvent(bookId, deliveryId);
      return { ok: true };
    },
  }),

  defineTool({
    name: 'list_tags',
    title: 'List tags',
    description:
      'List all tags. Use to resolve tag names to IDs before calling remove_tag.',
    input: {},
    annotations: READ,
    run: async () => (await library.getFilterOptions()).tags,
  }),

  defineTool({
    name: 'add_tag',
    title: 'Add tag',
    description:
      'Add a tag to a book. Creates the tag if it does not exist. Idempotent.',
    input: { bookId: z.number().int(), tagName: z.string().min(1) },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: ({ bookId, tagName }) => {
      const tagId = library.getOrCreateTag(tagName);
      library.addTagToBook(bookId, tagId);
      library.revalidateBookTagCache(bookId);
      return { ok: true, bookId, tagId, tagName };
    },
  }),

  defineTool({
    name: 'remove_tag',
    title: 'Remove tag',
    description:
      'Remove a tag from a book. Call list_tags first to get tag IDs.',
    input: { bookId: z.number().int(), tagId: z.number().int() },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    run: ({ bookId, tagId }) => {
      library.removeTagFromBook(bookId, tagId);
      library.revalidateBookTagCache(bookId);
      return { ok: true };
    },
  }),

  defineTool({
    name: 'list_notebooks',
    title: 'List notebooks',
    description:
      'List the scanned paper Bullet Journal notebooks, active first, with their page counts.',
    input: {},
    annotations: READ,
    run: async () =>
      (await library.listNotebooks()).map(
        ({ id, name, status, pageCount }) => ({ id, name, status, pageCount }),
      ),
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
      const pages = await library.getNotebookPages(notebookId, {
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
        const file = await library.readPageFile(page.id);
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
      const page = await library.setPageTranscription(pageId, input);
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
      const pages = await library.getNotebookPages(notebookId);
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
      const notebook = await library.renameNotebook(notebookId, name);
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
      const change = await library.reorderPages(notebookId, pageIds, {
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
      library.movePages(pageIds, toNotebookId, options),
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
      library.mergeNotebooks(sourceNotebookId, targetNotebookId, {
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
      const result = await library.deleteNotebook(notebookId, {
        deletePages,
        dryRun,
      });
      if (!result) throw new ToolInputError(`Notebook ${notebookId} not found`);
      return result;
    },
  }),
];
