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
  getBook,
  getBookList,
  listUndeliveredBooks,
} from '@/lib/queries';

export async function POST(request: Request): Promise<Response> {
  const server = new McpServer({ name: 'calibre-mcp', version: '0.0.1' });

  server.registerTool(
    'list_books',
    {
      description: 'Search and list books from the Calibre library with optional filters',
      inputSchema: {
        query: z.string().optional().describe('Full-text search across title and author'),
        authorId: z.number().int().optional().describe('Filter by author ID'),
        tagId: z.number().int().optional().describe('Filter by tag ID'),
        seriesId: z.number().int().optional().describe('Filter by series ID'),
        page: z.number().int().min(1).default(1).describe('Page number'),
        limit: z.number().int().min(1).max(100).default(30).describe('Results per page'),
      },
    },
    async (input) => {
      const result = await getBookList({
        q: input.query,
        authorId: input.authorId,
        tagId: input.tagId,
        seriesId: input.seriesId,
        page: input.page,
        limit: input.limit,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  server.registerTool(
    'get_book',
    {
      description: 'Get full details for a single book by its Calibre ID',
      inputSchema: {
        bookId: z.number().int().describe('Calibre book ID'),
      },
    },
    async (input) => {
      const book = await getBook(input.bookId);
      if (!book) {
        return { content: [{ type: 'text', text: `Book ${input.bookId} not found` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(book) }] };
    },
  );

  server.registerTool(
    'list_undelivered_books',
    {
      description: 'List books that have not yet been delivered to a given platform',
      inputSchema: {
        platformKey: z.string().describe('Platform key, e.g. "readwise-reader" or "notebooklm"'),
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
      description: 'Get delivery history for a book — which platforms it has been sent to',
      inputSchema: {
        bookId: z.number().int().describe('Calibre book ID'),
      },
    },
    async (input) => {
      const events = await listBookDeliveryEvents(input.bookId);
      return { content: [{ type: 'text', text: JSON.stringify(events) }] };
    },
  );

  server.registerTool(
    'add_delivery',
    {
      description: 'Record that a book was delivered to a platform',
      inputSchema: {
        bookId: z.number().int().describe('Calibre book ID'),
        platformKey: z.string().describe('Platform key, e.g. "readwise-reader" or "notebooklm"'),
        externalRef: z.string().optional().describe('External document ID or URL on the platform'),
        note: z.string().optional().describe('Optional note about this delivery'),
      },
    },
    async (input) => {
      await createBookDeliveryEvent(input.bookId, {
        platformKey: input.platformKey,
        externalRef: input.externalRef,
        note: input.note,
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ ok: true, bookId: input.bookId, platformKey: input.platformKey }),
        }],
      };
    },
  );

  server.registerTool(
    'bulk_add_delivery',
    {
      description: 'Record that multiple books were delivered to a platform in one operation',
      inputSchema: {
        bookIds: z.array(z.number().int()).describe('Array of Calibre book IDs'),
        platformKey: z.string().describe('Platform key, e.g. "readwise-reader" or "notebooklm"'),
        note: z.string().optional().describe('Optional note about this batch delivery'),
      },
    },
    async (input) => {
      const result = await bulkCreateDeliveryEvents(input.bookIds, {
        platformKey: input.platformKey,
        note: input.note,
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ ok: true, count: result.count, platformKey: input.platformKey }),
        }],
      };
    },
  );

  server.registerTool(
    'remove_delivery',
    {
      description: 'Remove a delivery record for a book',
      inputSchema: {
        bookId: z.number().int().describe('Calibre book ID'),
        deliveryId: z.number().int().describe('Delivery event ID to remove'),
      },
    },
    async (input) => {
      await deleteBookDeliveryEvent(input.bookId, input.deliveryId);
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] };
    },
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
