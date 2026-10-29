import type { AiController, AiState } from '@rainforest-dev/web-ai';

import {
  buildPrompt,
  isNarrowed,
  parseLibraryQuery,
  readByRules,
  relativeDays,
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
    expect(
      sanitizeAnswer({ text: 'notebook pages' }, 'notebook pages'),
    ).toEqual({ text: '' });
  });
});

describe('relativeDays', () => {
  it('reads days relative to today', () => {
    const today = '2026-10-29'; // a Thursday
    expect(relativeDays('上個月的筆記本', today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(relativeDays('notes from last week', today)).toEqual({
      from: '2026-10-19',
      to: '2026-10-25',
    });
    expect(relativeDays('本月', today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(relativeDays('昨天', today)).toEqual({
      from: '2026-10-28',
      to: '2026-10-28',
    });
    expect(relativeDays('去年', '2026-01-15')).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    });
    expect(relativeDays('lantern', today)).toBeUndefined();
  });

  it('wins over the days the model gave', () => {
    expect(
      sanitizeAnswer(
        { text: '', from: '2026-10-01' },
        '上個月的筆記本',
        '2026-10-29',
      ),
    ).toEqual({ text: '', from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('readByRules', () => {
  it('reads the collection and day words without a model', () => {
    expect(readByRules('筆記本裡的 garden', '2026-10-29')).toEqual({
      text: 'garden',
      collections: ['notebooks'],
    });
    expect(readByRules('lord of the rings 2', '2026-10-29')).toEqual({
      text: 'lord of the rings 2',
    });
    expect(readByRules('上個月的筆記本', '2026-10-29')).toEqual({
      text: '',
      collections: ['notebooks'],
      from: '2026-09-01',
      to: '2026-09-30',
    });
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
    const outcome = await parseLibraryQuery(
      'react in notebooks',
      '2026-10-29',
      ai,
    );
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

  it('keeps the typed words when the model leaves none and names no days', async () => {
    const ai = controller(
      { kind: 'ready' },
      { text: ' ', collections: ['kb'] },
    );
    expect((await parseLibraryQuery('kb', '2026-10-29', ai)).value).toEqual({
      text: 'kb',
      collections: ['kb'],
    });
  });

  it('asks for everything in the days when no words are left', async () => {
    const ai = controller(
      { kind: 'ready' },
      { text: '', collections: ['notebooks'], from: '', to: '' },
    );
    expect(
      (await parseLibraryQuery('上個月的筆記本', '2026-10-29', ai)).value,
    ).toEqual({
      text: '',
      collections: ['notebooks'],
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('does not ask the model about plain words', async () => {
    const ai = controller(
      { kind: 'ready' },
      { text: 'an', collections: ['rack'] },
    );
    expect(await parseLibraryQuery('an', '2026-10-29', ai)).toEqual({
      value: { text: 'an' },
      status: 'local',
    });
    expect(ai.run).not.toHaveBeenCalled();
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

  it('reads the words itself on an answer out of shape', async () => {
    const ai = controller({ kind: 'ready' }, { words: 'react' });
    expect(
      await parseLibraryQuery('react in notebooks', '2026-10-29', ai),
    ).toEqual({
      value: { text: 'react', collections: ['notebooks'] },
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
