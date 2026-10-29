import type { AiController, AiState } from '@rainforest-dev/web-ai';

import {
  buildPrompt,
  isNarrowed,
  parseLibraryQuery,
  sanitizeAnswer,
  searchParams,
} from './query-parse';

const controller = (state: AiState, answer?: unknown): AiController => ({
  getState: () => state,
  subscribe: () => () => undefined,
  refresh: async () => state,
  enable: async () => undefined,
  run: vi.fn(async () => answer) as AiController['run'],
  retain: () => () => undefined,
});

describe('sanitizeAnswer', () => {
  it('keeps known collections and well-formed days', () => {
    expect(
      sanitizeAnswer({
        text: 'react',
        collections: ['notebooks', 'films', 'notebooks'],
        from: '2026-09-01',
        to: 'September',
      }),
    ).toEqual({
      text: 'react',
      collections: ['notebooks'],
      from: '2026-09-01',
    });
  });

  it('drops a range that runs backwards', () => {
    expect(
      sanitizeAnswer({ text: 'x', from: '2026-10-01', to: '2026-09-01' }),
    ).toEqual({ text: 'x' });
  });
});

describe('parseLibraryQuery', () => {
  it('searches the words as typed without a model', async () => {
    expect(await parseLibraryQuery('react', '2026-10-29', undefined)).toEqual({
      value: { text: 'react' },
      status: 'local',
    });
  });

  it('never asks a model that is not on the device yet', async () => {
    const ai = controller({ kind: 'downloadable' });
    const outcome = await parseLibraryQuery('react', '2026-10-29', ai);
    expect(outcome.status).toBe('local');
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('reads collections and days with a ready model', async () => {
    const ai = controller(
      { kind: 'ready' },
      {
        text: 'react',
        collections: ['notebooks'],
        from: '2026-09-01',
        to: '2026-09-30',
      },
    );
    const raw = '上個月筆記本裡寫 react 的';
    const outcome = await parseLibraryQuery(raw, '2026-10-29', ai);
    expect(outcome).toEqual({
      status: 'ai',
      value: {
        text: 'react',
        collections: ['notebooks'],
        from: '2026-09-01',
        to: '2026-09-30',
      },
    });
    expect(ai.run).toHaveBeenCalledWith(
      buildPrompt(raw, '2026-10-29'),
      expect.objectContaining({ type: 'object' }),
      expect.objectContaining({
        languages: { input: ['en'], output: ['en'] },
      }),
    );
  });

  it('keeps the typed words when the model leaves none', async () => {
    const ai = controller(
      { kind: 'ready' },
      { text: ' ', collections: ['kb'] },
    );
    expect((await parseLibraryQuery('kb', '2026-10-29', ai)).value).toEqual({
      text: 'kb',
      collections: ['kb'],
    });
  });

  it('falls back to the typed words on an answer out of shape', async () => {
    const ai = controller({ kind: 'ready' }, { words: 'react' });
    expect(await parseLibraryQuery('react', '2026-10-29', ai)).toEqual({
      value: { text: 'react' },
      status: 'local',
    });
  });
});

describe('searchParams', () => {
  it('names the scope and days only when set', () => {
    expect(String(searchParams({ text: ' react ' }))).toBe('q=react');
    expect(
      String(
        searchParams({
          text: 'react',
          collections: ['books', 'kb'],
          from: '2026-09-01',
        }),
      ),
    ).toBe('q=react&in=books%2Ckb&from=2026-09-01');
  });

  it('says whether the query was narrowed', () => {
    expect(isNarrowed({ text: 'x' })).toBe(false);
    expect(isNarrowed({ text: 'x', to: '2026-09-01' })).toBe(true);
  });
});
