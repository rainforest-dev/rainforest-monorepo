import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type AiCall,
  createQueryParser,
  jsonSchemaOf,
  type ParserSchema,
  PROMPT_TIMEOUT_MS,
} from './query-parse';

type Q = { text: string };

const schema: ParserSchema<Q> = {
  '~standard': {
    validate: (v) =>
      typeof (v as Q | null)?.text === 'string'
        ? { value: { text: (v as Q).text.trim() } }
        : { issues: [{ message: 'bad' }] },
    jsonSchema: {
      input: () => ({
        $schema: 'x',
        type: 'object',
        properties: { text: { type: 'string' } },
      }),
    },
  },
};

const parser = createQueryParser<Q, { n: number }>({
  schema: () => schema,
  sanitize: (out) => out,
  local: (raw, ctx) => ({ text: `local:${raw}:${ctx.n}` }),
});

afterEach(() => vi.useRealTimers());

describe('jsonSchemaOf', () => {
  it('drops the $schema key', () => {
    expect(jsonSchemaOf(schema)).toEqual({
      type: 'object',
      properties: { text: { type: 'string' } },
    });
  });
});

describe('createQueryParser', () => {
  it('uses a valid AI answer', async () => {
    expect(
      await parser.parse('x', { n: 1 }, async () => ({ text: ' ai ' })),
    ).toEqual({ value: { text: 'ai' }, status: 'ai' });
  });

  it('falls back locally without AI, on an invalid answer and on a rejection', async () => {
    expect(await parser.parse('x', { n: 1 }, undefined)).toEqual({
      value: { text: 'local:x:1' },
      status: 'local',
    });
    expect((await parser.parse('x', { n: 1 }, async () => ({}))).status).toBe(
      'local',
    );
    expect(
      (
        await parser.parse('x', { n: 1 }, async () => {
          throw new Error('no');
        })
      ).status,
    ).toBe('local');
  });

  it('passes the JSON Schema to the AI call', async () => {
    const ai = vi.fn<AiCall>(async () => ({ text: 'a' }));
    await parser.parse('x', { n: 1 }, ai);
    expect(ai.mock.calls[0]?.[0]).toEqual({
      type: 'object',
      properties: { text: { type: 'string' } },
    });
  });

  it('times out, aborts the call and falls back', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = parser.parse('x', { n: 1 }, (_s, inner) => {
      signal = inner;
      return new Promise(() => undefined);
    });
    await vi.advanceTimersByTimeAsync(PROMPT_TIMEOUT_MS);
    expect(await pending).toEqual({
      value: { text: 'local:x:1' },
      status: 'ai-timeout',
    });
    expect(signal?.aborted).toBe(true);
  });

  it('aborts the AI call when the caller aborts', async () => {
    const outer = new AbortController();
    let signal: AbortSignal | undefined;
    const pending = parser.parse(
      'x',
      { n: 1 },
      (_s, inner) => {
        signal = inner;
        return new Promise((_, reject) =>
          inner.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      },
      outer.signal,
    );
    outer.abort();
    expect((await pending).status).toBe('local');
    expect(signal?.aborted).toBe(true);
  });
});
