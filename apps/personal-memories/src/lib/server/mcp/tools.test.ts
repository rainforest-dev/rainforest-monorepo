import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TimelineEvent } from '@/lib/server/timeline.ts';

import {
  buildFixture,
  CHAT_STEMS,
  connect,
  EMAILS,
  type Fixture,
  handlerFor,
  NOTE_EMAIL,
  RAMEN_DAY,
} from './testing.ts';
import {
  DAY_RANGE_MAX,
  type McpDeps,
  NOTE_MAX,
  OCR_MAX,
  TEXT_MAX,
} from './tools.ts';

let fixture: Fixture;
let client: Client;

beforeAll(async () => {
  fixture = await buildFixture();
  client = await connect(handlerFor(fixture.deps));
});

afterAll(async () => {
  await client.close();
  fixture.cleanup();
});

type Structured = Record<string, unknown>;

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = await client.callTool({ name, arguments: args });
  return result as {
    isError?: boolean;
    structuredContent?: Structured;
    content: { type: string; text: string }[];
  };
};

const ok = async (name: string, args: Record<string, unknown> = {}) => {
  const result = await call(name, args);
  expect(result.isError, result.content[0]?.text).toBeFalsy();
  return result.structuredContent as Structured & Record<string, never>;
};

const errorText = async (name: string, args: Record<string, unknown>) => {
  const result = await call(name, args);
  expect(result.isError).toBe(true);
  return result.content[0]?.text ?? '';
};

describe('tools/list', () => {
  it('lists the five tools, all read-only and closed-world', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([
      'search_memories',
      'get_day',
      'list_people',
      'get_coverage',
      'list_markers',
    ]);
    for (const tool of tools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        openWorldHint: false,
      });
      expect(tool.outputSchema).toMatchObject({ type: 'object' });
      expect(`${tool.name} ${tool.description}`).not.toMatch(/Alice|Bob/);
    }
  });

  it('publishes the limits in the input schemas', async () => {
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(byName['search_memories']?.inputSchema).toMatchObject({
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 200 },
        people: { type: 'array', maxItems: 10 },
        sources: {
          type: 'array',
          items: { enum: ['line', 'slack', 'photo', 'note'] },
        },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
      },
      required: ['query'],
    });
    expect(byName['get_day']?.inputSchema).toMatchObject({
      properties: {
        cursor: { type: 'integer', minimum: 0, default: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 100 },
      },
      required: ['date'],
    });
    expect(byName['get_coverage']?.inputSchema).toMatchObject({
      properties: { by: { enum: ['month', 'day'], default: 'month' } },
    });
  });
});

describe('search_memories', () => {
  it('finds the ramen day', async () => {
    const out = await ok('search_memories', { query: '拉麵' });
    const results = out['results'] as { date: string; source: string }[];
    expect(results[0]).toMatchObject({ date: RAMEN_DAY, source: 'line' });
    expect(out['semantic']).toBe('on');
  });

  it('respects limit', async () => {
    const out = await ok('search_memories', { query: 'Busy', limit: 1 });
    expect(out['results']).toHaveLength(1);
  });

  it('narrows to a range', async () => {
    const out = await ok('search_memories', {
      query: '拉麵',
      from: '2025-11-01',
      to: '2025-11-02',
    });
    for (const r of out['results'] as { date: string }[])
      expect(r.date <= '2025-11-02').toBe(true);
    expect(
      (out['results'] as { date: string }[]).map((r) => r.date),
    ).not.toContain(RAMEN_DAY);
  });

  it('searches diary notes, and only notes when asked', async () => {
    const out = await ok('search_memories', {
      query: '溏心蛋',
      sources: ['note'],
    });
    const results = out['results'] as { date: string; source: string }[];
    expect(results).toEqual([
      expect.objectContaining({ date: RAMEN_DAY, source: 'note' }),
    ]);
  });

  it('keeps notes out when sources leaves them out', async () => {
    const out = await ok('search_memories', {
      query: '溏心蛋',
      sources: ['line', 'slack', 'photo'],
    });
    for (const r of out['results'] as { source: string }[])
      expect(r.source).not.toBe('note');
  });

  it('filters by person id', async () => {
    const out = await ok('search_memories', { query: 'Busy', people: ['bob'] });
    expect((out['results'] as unknown[]).length).toBeGreaterThan(0);
  });

  it.each([
    [{ query: '拉麵', from: '2025-11-01' }, 'together'],
    [{ query: '拉麵', from: '2025-11-03', to: '2025-11-01' }, 'after'],
  ])('rejects a bad range %j', async (args, message) => {
    expect(await errorText('search_memories', args)).toContain(message);
  });

  it.each([
    { query: '   ' },
    { query: 'x'.repeat(201) },
    { query: 'x', limit: 21 },
    { query: 'x', limit: 0 },
    { query: 'x', people: Array.from({ length: 11 }, (_, i) => `p${i}`) },
    { query: 'x', sources: ['mail'] },
    { query: 'x', from: '2025/11/01', to: '2025-11-02' },
  ])('rejects input outside the limits %j', async (args) => {
    expect(await errorText('search_memories', args)).toMatch(
      /Input validation error/,
    );
  });

  it('answers no-index when the index is missing', async () => {
    const handler = handlerFor({
      ...fixture.deps,
      searchIndex: async () => undefined,
    });
    const other = await connect(handler);
    const result = await other.callTool({
      name: 'search_memories',
      arguments: { query: '拉麵' },
    });
    expect(result.structuredContent).toEqual({
      results: [],
      semantic: 'off',
      reason: 'no-index',
    });
    await other.close();
  });
});

describe('get_day', () => {
  it('returns display names, photo metadata, counts, neighbours and a url', async () => {
    const out = await ok('get_day', { date: '2025-11-01' });
    expect(out).toMatchObject({
      date: '2025-11-01',
      prev: '2025-10-31',
      next: '2025-11-02',
      url: 'https://memories.example.test/day/2025-11-01',
      counts: { line: expect.any(Number), slack: 3, photo: 7 },
    });
    const events = out['events'] as {
      source: string;
      author: string;
      text?: string;
      photo?: Record<string, unknown>;
    }[];
    const authors = new Set(events.map((e) => e.author));
    expect(authors).toContain('Alice');
    expect(authors).not.toContain('Alice 🌷');
    const photo = events.find((e) => e.photo?.['labels']);
    expect(photo?.photo).toMatchObject({
      labels: ['Ramen'],
      people: ['Alice'],
      mediaCount: 1,
    });
  });

  it('includes the note and its annotations', async () => {
    const out = await ok('get_day', { date: RAMEN_DAY });
    expect(out['note']).toMatchObject({
      body: expect.stringContaining('溏心蛋'),
      annotations: [
        {
          time: '12:10',
          source: 'line',
          author: 'Bob',
          excerpt: '台南的拉麵',
          by: 'Alice',
          text: '下次要加麵',
        },
      ],
    });
  });

  it('filters by source and leaves the note out unless asked', async () => {
    const out = await ok('get_day', {
      date: '2025-11-01',
      sources: ['photo'],
    });
    const events = out['events'] as { source: string }[];
    expect(events.length).toBe(7);
    expect(events.every((e) => e.source === 'photo')).toBe(true);
    const day = await ok('get_day', { date: RAMEN_DAY, sources: ['line'] });
    expect(day['note']).toBeUndefined();
  });

  it('pages a busy day with cursor and limit', async () => {
    const first = await ok('get_day', { date: '2025-10-31' });
    expect(first['events']).toHaveLength(100);
    expect(first['nextCursor']).toBe(100);
    const rest = await ok('get_day', { date: '2025-10-31', cursor: 100 });
    expect(rest['events']).toHaveLength(20);
    expect(rest['nextCursor']).toBeUndefined();
    const small = await ok('get_day', {
      date: '2025-10-31',
      cursor: 10,
      limit: 5,
    });
    expect((small['events'] as { text: string }[]).map((e) => e.text)).toEqual(
      [11, 12, 13, 14, 15].map((n) => `Busy message ${n}`),
    );
    expect(small['nextCursor']).toBe(15);
  });

  it('answers an unknown day with its neighbours only', async () => {
    expect(await ok('get_day', { date: '2025-11-02' })).toHaveProperty(
      'events',
    );
    expect(await ok('get_day', { date: '2025-10-01' })).toEqual({
      date: '2025-10-01',
      next: '2025-10-31',
    });
    expect(await ok('get_day', { date: '2030-01-01' })).toEqual({
      date: '2030-01-01',
      prev: '2025-11-04',
    });
  });

  it.each([
    { date: '2025-11' },
    { date: '2025-11-01', limit: 201 },
    { date: '2025-11-01', cursor: -1 },
  ])('rejects input outside the limits %j', async (args) => {
    expect(await errorText('get_day', args)).toMatch(/Input validation error/);
  });
});

describe('get_day clipping', () => {
  const event = (fields: Partial<TimelineEvent>): TimelineEvent => ({
    id: 'e1',
    source: 'line',
    at: '2025-12-01T09:00:00+08:00',
    author: 'Alice',
    ...fields,
  });

  it('clips message text, OCR text and the note body', async () => {
    const deps: McpDeps = {
      ...fixture.deps,
      timeline: async () => {
        const events = [
          event({ text: 'あ'.repeat(TEXT_MAX + 50) }),
          event({
            id: 'e2',
            text: `記${'記'.repeat(50)}a@b.com-c@d.com-e@f.com`,
          }),
          event({
            id: 'p1',
            source: 'photo',
            author: 'photo',
            photo: {
              favorite: false,
              people: 0,
              screenshot: false,
              movie: false,
              burstPick: false,
              meta: { text: ['字'.repeat(OCR_MAX + 50)] },
            },
            media: [{ path: '/Users/someone/Pictures/IMG_9.heic' }],
          }),
        ];
        return {
          status: 'ready',
          timeline: { generatedAt: '2025-12-02T00:00:00Z', events },
          byId: new Map(events.map((e) => [e.id, e])),
        };
      },
      notes: () => ({
        root: '',
        writable: false,
        write: () => {
          throw new Error('read-only');
        },
        dates: () => new Set(),
        read: (date: string) => ({
          note: {
            date,
            frontmatter: {},
            body: '記'.repeat(NOTE_MAX + 50),
            annotations: [],
          },
          version: 'v',
        }),
      }),
    };
    const other = await connect(handlerFor(deps));
    const result = await other.callTool({
      name: 'get_day',
      arguments: { date: '2025-12-01' },
    });
    const out = result.structuredContent as {
      events: { text?: string; photo?: { text?: string } }[];
      note: { body: string };
    };
    const [message, emails, photo] = out.events;
    expect(Array.from(message?.text ?? '')).toHaveLength(TEXT_MAX);
    expect(message?.text?.endsWith('…')).toBe(true);
    expect(emails?.text).toBe('[email]'.repeat(3));
    expect(Array.from(photo?.photo?.text ?? '')).toHaveLength(OCR_MAX);
    expect(Array.from(out.note.body)).toHaveLength(NOTE_MAX);
    expect(JSON.stringify(result)).not.toContain('/Users/');
    await other.close();
  });
});

describe('list_people', () => {
  it('lists people without emails and names the owner', async () => {
    expect(await ok('list_people')).toEqual({
      people: [
        { id: 'bob', name: 'Bob', aliases: { slack: ['bob'] } },
        {
          id: 'alice',
          name: 'Alice',
          aliases: { slack: ['alice'], line: ['Alice 🌷'] },
        },
      ],
      owner: 'bob',
    });
  });
});

describe('get_coverage', () => {
  it('reports the span, freshness, totals and monthly buckets', async () => {
    const out = await ok('get_coverage');
    expect(out).toMatchObject({
      firstDate: '2025-10-31',
      lastDate: RAMEN_DAY,
      generatedAt: expect.any(String),
      lastImport: { at: '2025-11-04T03:30:00.000Z', ok: true },
      totals: { slack: 6, photo: 8, notes: 1 },
    });
    const buckets = out['buckets'] as { key: string; note: number }[];
    expect(buckets.map((b) => b.key)).toEqual(['2025-10', '2025-11']);
    expect(buckets[1]?.note).toBe(1);
  });

  it('buckets by day inside a range, zeros included', async () => {
    const out = await ok('get_coverage', {
      from: '2025-11-01',
      to: '2025-11-03',
      by: 'day',
    });
    const buckets = out['buckets'] as {
      key: string;
      line: number;
      slack: number;
      photo: number;
      note: number;
    }[];
    expect(buckets.map((b) => b.key)).toEqual([
      '2025-11-01',
      '2025-11-02',
      RAMEN_DAY,
    ]);
    expect(buckets[0]).toMatchObject({ slack: 3, photo: 7, note: 0 });
    expect(buckets[2]).toMatchObject({ slack: 0, photo: 0, note: 1 });
    expect((out['totals'] as { photo: number }).photo).toBe(8);
  });

  it(`refuses by day past ${DAY_RANGE_MAX} days`, async () => {
    expect(
      await errorText('get_coverage', {
        from: '2024-01-01',
        to: '2025-01-01',
        by: 'day',
      }),
    ).toContain(`${DAY_RANGE_MAX} days`);
    expect(
      await ok('get_coverage', {
        from: '2024-01-01',
        to: '2024-12-31',
        by: 'day',
      }),
    ).toMatchObject({ buckets: [] });
  });

  it('rejects from after to', async () => {
    expect(
      await errorText('get_coverage', { from: '2025-11-03', to: '2025-11-01' }),
    ).toContain('after');
  });
});

describe('privacy', () => {
  const CALLS: [string, Record<string, unknown>][] = [
    ['search_memories', { query: '拉麵' }],
    ['search_memories', { query: 'map' }],
    ['search_memories', { query: 'Ramen', sources: ['photo'] }],
    ['search_memories', { query: '溏心蛋' }],
    ['search_memories', { query: 'example' }],
    ['get_day', { date: '2025-10-31', limit: 200 }],
    ['get_day', { date: '2025-11-01', limit: 200 }],
    ['get_day', { date: '2025-11-02', limit: 200 }],
    ['get_day', { date: RAMEN_DAY, limit: 200 }],
    ['list_people', {}],
    ['get_coverage', {}],
    ['get_coverage', { from: '2025-10-31', to: RAMEN_DAY, by: 'day' }],
  ];

  it.each(CALLS)(
    '%s %j returns no emails, paths or chat file names',
    async (name, args) => {
      const json = JSON.stringify(await call(name, args));
      expect(json).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      for (const email of [...EMAILS, NOTE_EMAIL])
        expect(json).not.toContain(email);
      expect(json).not.toContain('/Users/');
      expect(json).not.toContain(fixture.root);
      expect(json).not.toContain('photoslibrary');
      expect(json).not.toMatch(/IMG_\d|MOV_\d|map\.png/);
      expect(json).not.toMatch(/"(chat|path|media|emails)"\s*:/);
      for (const stem of CHAT_STEMS.filter((s) => s !== 'chat'))
        expect(json).not.toContain(stem);
      expect(json).not.toMatch(/"chat"/);
    },
  );
});

describe('markers', () => {
  it('get_day returns the markers of a day with events', async () => {
    const out = await ok('get_day', { date: '2025-11-03' });
    expect(out['markers']).toEqual([
      {
        person: 'Alice',
        personId: 'alice',
        kind: 'leave',
        part: 'am',
        eventId: expect.any(String),
        postedOn: '2025-11-02',
      },
      expect.objectContaining({ kind: 'wfh', part: 'pm' }),
    ]);
  });

  it('get_day opens a day that only has markers', async () => {
    const out = await ok('get_day', { date: '2025-11-04' });
    expect(out).toMatchObject({
      date: '2025-11-04',
      prev: '2025-11-03',
      counts: { line: 0, slack: 0, photo: 0 },
      events: [],
      markers: [expect.objectContaining({ kind: 'leave', part: 'full' })],
    });
  });

  it('get_day ignores the source filter for markers', async () => {
    const out = await ok('get_day', { date: '2025-11-01', sources: ['photo'] });
    expect(out['markers']).toEqual([
      expect.objectContaining({
        person: 'Bob',
        kind: 'wfh',
        postedOn: '2025-11-01',
      }),
    ]);
  });

  it('list_markers filters by range, person and kind', async () => {
    const all = await ok('list_markers');
    expect((all['markers'] as unknown[]).length).toBe(4);
    const leave = await ok('list_markers', {
      person: 'alice',
      kind: 'leave',
      from: '2025-11-04',
    });
    expect(leave['markers']).toEqual([
      expect.objectContaining({ date: '2025-11-04', part: 'full' }),
    ]);
  });

  it('list_markers rejects an unknown person and a reversed range', async () => {
    expect(await errorText('list_markers', { person: 'carol' })).toMatch(
      /list_people/,
    );
    expect(
      await errorText('list_markers', { from: '2025-11-04', to: '2025-11-01' }),
    ).toMatch(/after/);
  });

  it('list_markers leaves postedOn out when the source message is gone', async () => {
    const other = await connect(
      handlerFor({
        ...fixture.deps,
        markers: async () => ({
          markers: [
            {
              date: '2025-11-05',
              person: 'bob',
              kind: 'wfh',
              part: 'am',
              event: 'gone',
            },
          ],
          byDate: new Map(),
          dates: [],
        }),
      }),
    );
    const result = await other.callTool({
      name: 'list_markers',
      arguments: {},
    });
    await other.close();
    const [marker] = (result.structuredContent as { markers: object[] })
      .markers;
    expect(marker).not.toHaveProperty('postedOn');
  });
});

describe('get_day reads', () => {
  it('reads the timeline once per call', async () => {
    let reads = 0;
    const counted = await connect(
      handlerFor({
        ...fixture.deps,
        timeline: async () => {
          reads++;
          return fixture.deps.timeline();
        },
      }),
    );
    await counted.callTool({
      name: 'get_day',
      arguments: { date: '2025-11-03' },
    });
    await counted.close();
    expect(reads).toBe(1);
  });
});
