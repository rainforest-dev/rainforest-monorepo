import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { fakeLibrary } from './testing';
import {
  addDeliveryInputSchema,
  type CalibreLibrary,
  calibreTools,
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
