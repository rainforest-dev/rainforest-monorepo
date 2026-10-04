import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Person } from '@/lib/people.ts';

import {
  parseWithFallback,
  PROMPT_TIMEOUT_MS,
  promptSchema,
  queryLanguage,
  readSwitch,
  statusText,
  toSearchQuery,
} from './prompt-parse.ts';

const PEOPLE: Person[] = [{ id: 'bob', name: 'Bob', aliases: {} }];
const TODAY = '2026-10-01';

afterEach(() => {
  vi.useRealTimers();
});

describe('queryLanguage', () => {
  it('treats any CJK character as Chinese and everything else as English', () => {
    expect(queryLanguage('拉麵')).toBe('zh');
    expect(queryLanguage('ramen 拉麵')).toBe('zh');
    expect(queryLanguage('ramen last christmas')).toBe('en');
  });
});

describe('readSwitch', () => {
  it('is on only for a stored 1, and off when storage is blocked', () => {
    expect(readSwitch({ getItem: () => '1' })).toBe(true);
    expect(readSwitch({ getItem: () => null })).toBe(false);
    expect(
      readSwitch({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe(false);
    expect(readSwitch(undefined)).toBe(false);
  });
});

describe('statusText', () => {
  it('names the parser that ran and why', () => {
    expect(statusText({ kind: 'unsupported-browser' })).toBe(
      '這個瀏覽器沒有內建 AI 模型，使用內建解析',
    );
    expect(statusText({ kind: 'unsupported-language', lang: 'zh' })).toBe(
      'AI 模型還不支援中文，這次用內建解析',
    );
    expect(statusText({ kind: 'downloading', progress: 0.42 })).toBe(
      '下載 AI 模型 42%',
    );
    expect(statusText({ kind: 'ai' })).toBe('AI 解析');
    expect(statusText({ kind: 'ai-timeout' })).toBe(
      'AI 解析逾時，改用內建解析',
    );
  });
});

describe('promptSchema and toSearchQuery', () => {
  it('limits people to the roster', () => {
    const schema = promptSchema(PEOPLE) as {
      properties: { people: { items: { enum: string[] } } };
    };
    expect(schema.properties.people.items.enum).toEqual(['bob']);
  });

  it('accepts a well-formed answer and drops what does not fit', () => {
    expect(
      toSearchQuery(
        {
          text: 'ramen',
          range: { start: '2025-12-25', end: '2025-12-25' },
          people: ['bob', 'eve'],
          sources: ['line', 'fax'],
        },
        PEOPLE,
      ),
    ).toEqual({
      text: 'ramen',
      range: { start: '2025-12-25', end: '2025-12-25' },
      people: ['bob'],
      sources: ['line'],
    });
  });

  it('rejects an answer without text or with a bad range', () => {
    expect(toSearchQuery({ people: ['bob'] }, PEOPLE)).toBeUndefined();
    expect(
      toSearchQuery(
        { text: 'x', range: { start: '2025-13-01', end: 'soon' } },
        PEOPLE,
      ),
    ).toBeUndefined();
    expect(toSearchQuery('ramen', PEOPLE)).toBeUndefined();
  });
});

describe('parseWithFallback', () => {
  it('uses a valid AI answer', async () => {
    const ai = vi.fn(async () => ({ text: 'ramen', people: ['bob'] }));
    expect(
      await parseWithFallback('ramen with Bob', TODAY, PEOPLE, ai),
    ).toEqual({ query: { text: 'ramen', people: ['bob'] }, status: 'ai' });
  });

  it('falls back to the local parser on an invalid answer or a rejection', async () => {
    const bad = vi.fn(async () => ({ nonsense: true }));
    expect(await parseWithFallback('Bob ramen', TODAY, PEOPLE, bad)).toEqual({
      query: { text: 'ramen', people: ['bob'] },
      status: 'local',
    });
    const failing = vi.fn(async () => {
      throw new Error('no');
    });
    expect(
      (await parseWithFallback('ramen', TODAY, PEOPLE, failing)).status,
    ).toBe('local');
    expect(
      (await parseWithFallback('ramen', TODAY, PEOPLE, undefined)).status,
    ).toBe('local');
  });

  it('gives up on the AI after the timeout and aborts it', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const hang = vi.fn(
      (_raw: string, signal: AbortSignal) =>
        new Promise<unknown>(() => {
          signal.addEventListener('abort', () => {
            aborted = true;
          });
        }),
    );
    const pending = parseWithFallback('ramen', TODAY, PEOPLE, hang);
    await vi.advanceTimersByTimeAsync(PROMPT_TIMEOUT_MS);
    expect(await pending).toEqual({
      query: { text: 'ramen' },
      status: 'ai-timeout',
    });
    expect(aborted).toBe(true);
  });
});
