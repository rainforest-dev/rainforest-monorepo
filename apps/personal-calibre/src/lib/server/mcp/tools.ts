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
  getNotebookPages,
  listNotebooks,
  readPageFile,
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

export const calibreTools = (library: CalibreLibrary): McpTool[] => [
  defineTool({
    name: 'list_books',
    title: 'List books',
    description:
      'Search and list books. The query is full-text plus semantic, ordered by relevance unless sortBy (with sortDir) is set, and lexical-only when the embedding service is unreachable; queries under 3 characters match by substring. When groupBy is set, returns { groups } with 6 preview books each, in each group\'s own order; otherwise returns { books, total }. Both carry semantic ("on" | "off") and, when semantic search could not answer, reason.',
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
];
