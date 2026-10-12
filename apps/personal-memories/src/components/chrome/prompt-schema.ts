import { z } from 'astro/zod';

import type { Person } from '@/lib/people.ts';
import type { SearchQuery } from '@/lib/search';

const MAX_TEXT = 200;
const SOURCES = ['line', 'slack', 'photo'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const day = z
  .string()
  .regex(DAY)
  .refine((s) => DATE.test(s));

function buildSchema(ids: readonly string[]) {
  const text = z
    .string()
    .transform((t) => Array.from(t.trim()).slice(0, MAX_TEXT).join(''));
  const range = z
    .object({ start: day, end: day })
    .refine((r) => r.start <= r.end)
    .optional();
  const sources = z.array(z.enum(SOURCES)).optional();
  return ids.length
    ? z.object({
        text,
        range,
        people: z.array(z.enum(ids as [string, ...string[]])).optional(),
        sources,
      })
    : z.object({ text, range, sources });
}

let memo: { key: string; schema: ReturnType<typeof buildSchema> } | undefined;

export function promptQuerySchema(people: readonly Person[]) {
  const ids = people.map((p) => p.id);
  const key = ids.join('\u0000');
  if (memo?.key !== key) memo = { key, schema: buildSchema(ids) };
  return memo.schema;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function sanitizeAnswer(
  output: unknown,
  people: readonly Person[],
): unknown {
  if (!isRecord(output)) return output;
  const ids = new Set(people.map((p) => p.id));
  const keep = <T>(list: unknown, ok: (v: unknown) => v is T) =>
    Array.isArray(list) ? list.filter(ok) : [];
  const picked = keep(
    output['people'],
    (v): v is string => typeof v === 'string' && ids.has(v),
  );
  const sources = keep(output['sources'], (v): v is string =>
    (SOURCES as readonly unknown[]).includes(v),
  );
  const { people: _p, sources: _s, ...rest } = output;
  return {
    ...rest,
    ...(picked.length ? { people: picked } : {}),
    ...(sources.length ? { sources } : {}),
  };
}

export const toQuery = (
  output: unknown,
  people: readonly Person[],
): SearchQuery | undefined => {
  const parsed = promptQuerySchema(people).safeParse(
    sanitizeAnswer(output, people),
  );
  return parsed.success ? parsed.data : undefined;
};
