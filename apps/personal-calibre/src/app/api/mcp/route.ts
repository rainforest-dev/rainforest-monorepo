import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp';
import { z } from 'zod';

import {
  bulkCreateDeliveryEvents,
  createBookDeliveryEvent,
  deleteBookDeliveryEvent,
  listBookDeliveryEvents,
} from '@/lib/delivery';
import {
  type GroupBy,
  getBook,
  getBookList,
  getFilterOptions,
  getGroupedBookList,
  listUndeliveredBooks,
} from '@/lib/queries';
import { addTagToBook, getOrCreateTag, removeTagFromBook, revalidateBookTagCache } from '@/lib/tags';

export async function POST(request: Request): Promise<Response> {
  const server = new McpServer({ name: 'calibre-mcp', version: '0.1.0' });

  server.registerTool(
    'list_books',
    {
      description:
        'Search and list books. When groupBy is set, returns { groups } with 6 preview books each; otherwise returns { books, total }.',
      inputSchema: {
        query: z.string().optional().describe('Full-text search'),
        authorId: z.number().int().optional(),
        tagId: z.number().int().optional(),
        seriesId: z.number().int().optional(),
        platformKey: z.string().optional().describe('Platform key, e.g. "readwise-reader"'),
        delivered: z.boolean().optional().describe('true=delivered only, false=undelivered only'),
        groupBy: z.enum(['series', 'tag', 'author']).optional(),
        sortBy: z.enum(['title', 'author', 'pubdate', 'added', 'rating']).optional(),
        sortDir: z.enum(['asc', 'desc']).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(30),
      },
    },
    async (input) => {
      if (input.groupBy) {
        const result = await getGroupedBookList({
          q: input.query,
          authorId: input.authorId,
          tagId: input.tagId,
          seriesId: input.seriesId,
          platformKey: input.platformKey,
          delivered: input.delivered,
          groupBy: input.groupBy as GroupBy,
          sortBy: input.sortBy,
          sortDir: input.sortDir,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      }
      const result = await getBookList({
        q: input.query,
        authorId: input.authorId,
        tagId: input.tagId,
        seriesId: input.seriesId,
        platformKey: input.platformKey,
        delivered: input.delivered,
        sortBy: input.sortBy,
        sortDir: input.sortDir,
        page: input.page,
        limit: input.limit,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'get_book',
    {
      description: 'Get full details for a single book',
      inputSchema: { bookId: z.number().int() },
    },
    async (input) => {
      const book = await getBook(input.bookId);
      if (!book) return { content: [{ type: 'text', text: `Book ${input.bookId} not found` }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(book) }] };
    },
  );

  server.registerTool(
    'list_undelivered_books',
    {
      description: 'List books not yet delivered to a platform',
      inputSchema: {
        platformKey: z.string(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(30),
      },
    },
    async (input) => {
      const result = await listUndeliveredBooks({
        platformKey: input.platformKey,
        page: input.page,
        limit: input.limit,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'list_deliveries',
    {
      description: 'Get delivery history for a book',
      inputSchema: { bookId: z.number().int() },
    },
    async (input) => {
      const events = await listBookDeliveryEvents(input.bookId);
      return { content: [{ type: 'text', text: JSON.stringify(events) }] };
    },
  );

  server.registerTool(
    'add_delivery',
    {
      description: 'Record a book as delivered to a platform',
      inputSchema: {
        bookId: z.number().int(),
        platformKey: z.string(),
        externalRef: z.string().optional(),
        note: z.string().optional(),
      },
    },
    async (input) => {
      await createBookDeliveryEvent(input.bookId, {
        platformKey: input.platformKey,
        externalRef: input.externalRef,
        note: input.note,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, bookId: input.bookId, platformKey: input.platformKey }) }],
      };
    },
  );

  server.registerTool(
    'bulk_add_delivery',
    {
      description: 'Record multiple books as delivered to a platform',
      inputSchema: {
        bookIds: z.array(z.number().int()),
        platformKey: z.string(),
        note: z.string().optional(),
      },
    },
    async (input) => {
      const result = await bulkCreateDeliveryEvents(input.bookIds, {
        platformKey: input.platformKey,
        note: input.note,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, count: result.count, platformKey: input.platformKey }) }],
      };
    },
  );

  server.registerTool(
    'remove_delivery',
    {
      description: 'Remove a delivery record',
      inputSchema: { bookId: z.number().int(), deliveryId: z.number().int() },
    },
    async (input) => {
      await deleteBookDeliveryEvent(input.bookId, input.deliveryId);
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
    },
  );

  server.registerTool(
    'list_tags',
    {
      description: 'List all tags. Use to resolve tag names to IDs before calling remove_tag.',
      inputSchema: {},
    },
    async () => {
      const { tags } = await getFilterOptions();
      return { content: [{ type: 'text', text: JSON.stringify(tags) }] };
    },
  );

  server.registerTool(
    'add_tag',
    {
      description: 'Add a tag to a book. Creates the tag if it does not exist. Idempotent.',
      inputSchema: { bookId: z.number().int(), tagName: z.string().min(1) },
    },
    async (input) => {
      const tagId = getOrCreateTag(input.tagName);
      addTagToBook(input.bookId, tagId);
      revalidateBookTagCache(input.bookId);
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, bookId: input.bookId, tagId, tagName: input.tagName }) }],
      };
    },
  );

  server.registerTool(
    'remove_tag',
    {
      description: 'Remove a tag from a book. Call list_tags first to get tag IDs.',
      inputSchema: { bookId: z.number().int(), tagId: z.number().int() },
    },
    async (input) => {
      removeTagFromBook(input.bookId, input.tagId);
      revalidateBookTagCache(input.bookId);
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
    },
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
