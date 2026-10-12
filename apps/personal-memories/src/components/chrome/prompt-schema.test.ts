import { jsonSchemaOf } from '@rainforest-dev/web-ai';
import { describe, expect, it } from 'vitest';

import type { Person } from '@/lib/people.ts';
import type { SearchQuery } from '@/lib/search';
import type { TimelineSource } from '@/lib/server';

import { promptQuerySchema, toQuery } from './prompt-schema.ts';

const people = [
  { id: 'alice', name: 'Alice', aliases: {} },
  { id: 'bob', name: 'Bob', aliases: { line: ['Bobby'] } },
] as unknown as Person[];

const MAX_TEXT = 200;
const SOURCES = ['line', 'slack', 'photo'] as const;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function legacyPromptSchema(
  people: readonly Person[],
): Record<string, unknown> {
  const date = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
  return {
    type: 'object',
    properties: {
      text: { type: 'string' },
      range: {
        type: 'object',
        properties: { start: date, end: date },
        required: ['start', 'end'],
      },
      ...(people.length
        ? {
            people: {
              type: 'array',
              items: { type: 'string', enum: people.map((p) => p.id) },
            },
          }
        : {}),
      sources: { type: 'array', items: { type: 'string', enum: SOURCES } },
    },
    required: ['text'],
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function legacyToSearchQuery(
  output: unknown,
  people: readonly Person[],
): SearchQuery | undefined {
  if (!isRecord(output) || typeof output['text'] !== 'string') return undefined;
  const query: SearchQuery = {
    text: Array.from(output['text'].trim()).slice(0, MAX_TEXT).join(''),
  };
  const range = output['range'];
  if (range !== undefined) {
    if (
      !isRecord(range) ||
      typeof range['start'] !== 'string' ||
      typeof range['end'] !== 'string' ||
      !DATE.test(range['start']) ||
      !DATE.test(range['end']) ||
      range['start'] > range['end']
    )
      return undefined;
    query.range = { start: range['start'], end: range['end'] };
  }
  const ids = new Set(people.map((p) => p.id));
  const picked = Array.isArray(output['people'])
    ? output['people'].filter(
        (id): id is string => typeof id === 'string' && ids.has(id),
      )
    : [];
  if (picked.length) query.people = picked;
  const sources = Array.isArray(output['sources'])
    ? output['sources'].filter((s): s is TimelineSource =>
        (SOURCES as readonly unknown[]).includes(s),
      )
    : [];
  if (sources.length) query.sources = sources;
  return query;
}

describe('promptQuerySchema', () => {
  it('generates the same JSON Schema as the hand-written one', () => {
    expect(jsonSchemaOf(promptQuerySchema(people))).toEqual(
      legacyPromptSchema(people),
    );
    expect(jsonSchemaOf(promptQuerySchema([]))).toEqual(legacyPromptSchema([]));
  });

  it('validates like toSearchQuery', () => {
    const answers: unknown[] = [
      { text: ' 拉麵 ' },
      { text: 'x'.repeat(300) },
      { text: 'a', people: ['bob', 'carol'], sources: ['line', 'fax'] },
      { text: 'a', range: { start: '2025-11-01', end: '2025-11-30' } },
      { text: 'a', range: { start: '2025-11-30', end: '2025-11-01' } },
      { text: 'a', range: { start: '2025-13-01', end: '2025-13-02' } },
      { text: 'a', range: null },
      { text: 1 },
      null,
      { text: 'a', people: 'bob' },
      { text: 'a', extra: true },
    ];
    for (const answer of answers)
      expect(toQuery(answer, people)).toEqual(
        legacyToSearchQuery(answer, people),
      );
  });
});
