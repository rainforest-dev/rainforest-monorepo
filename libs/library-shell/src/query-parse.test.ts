import type { AiController, AiState } from '@rainforest-dev/web-ai';

import {
  buildPrompt,
  isNarrowed,
  parseLibraryQuery,
  sanitizeAnswer,
  searchParams,
  warmLibraryModel,
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
      sanitizeAnswer(
        {
          text: 'react',
          collections: ['notebooks', 'films', 'notebooks'],
          from: '2026-09-01',
          to: 'September',
        },
        'react in my notebooks since September',
      ),
    ).toEqual({
      text: 'react',
      collections: ['notebooks'],
      from: '2026-09-01',
    });
  });

  it('drops a range that runs backwards', () => {
    expect(
      sanitizeAnswer(
        { text: 'x', from: '2026-10-01', to: '2026-09-01' },
        'x in 2026',
      ),
    ).toEqual({ text: 'x' });
  });

  it('drops a collection or days the search never names', () => {
    expect(
      sanitizeAnswer(
        { text: 'an', collections: ['rack'], from: '2026-09-01' },
        'an',
      ),
    ).toEqual({ text: 'an' });
    expect(
      sanitizeAnswer(
        { text: 'garden', collections: ['notebooks', 'books'] },
        '筆記本裡的 garden',
      ),
    ).toEqual({ text: 'garden', collections: ['notebooks'] });
  });

  it('takes collection names and filler out of the search words', () => {
    expect(
      sanitizeAnswer(
        { text: 'books about lantern', collections: ['books'] },
        'books about lantern',
      ),
    ).toEqual({ text: 'lantern', collections: ['books'] });
    expect(sanitizeAnswer({ text: '筆記本 react' }, '筆記本 react')).toEqual({
      text: 'react',
    });
    // Nothing but framing left: the words stay as the model gave them.
    expect(
      sanitizeAnswer({ text: 'notebook pages' }, 'notebook pages'),
    ).toEqual({ text: 'notebook pages' });
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

  it('tries once more when the model throws', async () => {
    const ai = controller({ kind: 'ready' });
    vi.mocked(ai.run)
      .mockRejectedValueOnce(new DOMException('x', 'UnknownError'))
      .mockResolvedValueOnce({ text: 'garden', collections: ['notebooks'] });
    expect(
      await parseLibraryQuery('garden in notebooks', '2026-10-29', ai),
    ).toEqual({
      status: 'ai',
      value: { text: 'garden', collections: ['notebooks'] },
    });
    expect(ai.run).toHaveBeenCalledTimes(2);
  });

  it('falls back to the typed words on an answer out of shape', async () => {
    const ai = controller({ kind: 'ready' }, { words: 'react' });
    expect(await parseLibraryQuery('react', '2026-10-29', ai)).toEqual({
      value: { text: 'react' },
      status: 'local',
    });
  });
});

describe('warmLibraryModel', () => {
  it('opens the session once, and only for a model on the device', async () => {
    const ready = controller({ kind: 'ready' });
    warmLibraryModel(ready);
    warmLibraryModel(ready);
    await vi.waitFor(() => expect(ready.run).toHaveBeenCalledTimes(1));
    const missing = controller({ kind: 'downloadable' });
    warmLibraryModel(missing);
    await Promise.resolve();
    expect(missing.run).not.toHaveBeenCalled();
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
