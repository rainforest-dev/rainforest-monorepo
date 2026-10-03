import { describe, expect, it } from 'vitest';

import {
  buildDeskSearch,
  clampPage,
  clearSourceFilters,
  DEFAULT_DESK_PARAMS,
  type DeskParams,
  historyMode,
  parseDeskParams,
  patchDeskParams,
} from './params';

const roundTrip = (search: string): string =>
  buildDeskSearch(parseDeskParams(search));

describe('parseDeskParams', () => {
  it('defaults to the sources tab with nothing applied', () => {
    expect(parseDeskParams('')).toEqual(DEFAULT_DESK_PARAMS);
  });

  it('reads every param', () => {
    expect(
      parseDeskParams(
        'tab=queue&q=css&status=proposed,active&stale=delivery-gap&cat=Design&tag=tech/css,devops&page=3&source=Lantern%20Notes&tq=edge&tstatus=declined&tier=2&sort=minutes&dir=desc',
      ),
    ).toEqual({
      tab: 'queue',
      validate: false,
      q: 'css',
      status: ['proposed', 'active'],
      stale: ['delivery-gap'],
      cat: ['Design'],
      tag: ['tech/css', 'devops'],
      page: 3,
      source: 'Lantern Notes',
      tq: 'edge',
      tstatus: 'declined',
      tier: 2,
      sort: 'minutes',
      dir: 'desc',
    } satisfies DeskParams);
  });

  it('maps the old validate tab to sources with the popover open', () => {
    const params = parseDeskParams('tab=validate');
    expect(params.tab).toBe('sources');
    expect(params.validate).toBe(true);
    expect(buildDeskSearch(params)).toBe('');
  });

  it('drops unknown enum values and keeps the known ones', () => {
    const params = parseDeskParams(
      'tab=nope&status=active,bogus&stale=nope&tstatus=maybe&tier=5&sort=colour&dir=sideways',
    );
    expect(params.tab).toBe('sources');
    expect(params.validate).toBe(false);
    expect(params.status).toEqual(['active']);
    expect(params.stale).toEqual([]);
    expect(params.tstatus).toBeNull();
    expect(params.tier).toBeNull();
    expect(params.sort).toBe('rank');
    expect(params.dir).toBe('asc');
  });

  it.each(['0', '-2', '1.5', 'two', '', '99999999999999999999'])(
    'falls back to page 1 for page=%s',
    (page) => {
      expect(parseDeskParams(`page=${page}`).page).toBe(1);
    },
  );

  it('trims search text and treats blank as absent', () => {
    expect(parseDeskParams('q=%20%20css%20').q).toBe('css');
    expect(parseDeskParams('q=%20%20').q).toBe('');
    expect(parseDeskParams('source=').source).toBeNull();
  });

  it('dedupes list values and skips empty ones', () => {
    expect(parseDeskParams('tag=css,,css,%20,devops').tag).toEqual([
      'css',
      'devops',
    ]);
  });

  it('accepts URLSearchParams', () => {
    expect(parseDeskParams(new URLSearchParams('tab=topics')).tab).toBe(
      'topics',
    );
  });
});

describe('buildDeskSearch', () => {
  it('returns an empty string for the defaults', () => {
    expect(buildDeskSearch(DEFAULT_DESK_PARAMS)).toBe('');
  });

  it.each([
    '?tab=topics',
    '?tab=queue&tier=1&sort=saved&dir=desc',
    '?q=css&status=proposed%2Cactive&stale=feed-dead&cat=Design&tag=tech%2Fcss&page=2',
    '?tab=topics&tq=edge&tstatus=proposed',
  ])('round-trips %s', (search) => {
    expect(roundTrip(search.slice(1))).toBe(search);
  });

  it.each(['Grid & Gutter', 'Bits & Pieces Weekly', '紙の燈籠 notes', 'a+b=c'])(
    'round-trips the source name %s',
    (name) => {
      const search = buildDeskSearch({ ...DEFAULT_DESK_PARAMS, source: name });
      expect(parseDeskParams(search).source).toBe(name);
    },
  );

  it('omits page 1 and the default queue sort', () => {
    expect(
      buildDeskSearch({
        ...DEFAULT_DESK_PARAMS,
        page: 1,
        sort: 'rank',
        dir: 'asc',
      }),
    ).toBe('');
  });
});

describe('patchDeskParams', () => {
  const onPage3 = parseDeskParams('q=css&status=active&page=3&source=X');

  it.each([
    { q: 'news' },
    { status: ['proposed' as const] },
    { stale: ['low-value' as const] },
    { cat: ['Design'] },
    { tag: ['devops'] },
  ])('drops page on a search or facet change: %o', (patch) => {
    expect(patchDeskParams(onPage3, patch).page).toBe(1);
  });

  it('keeps page for other changes', () => {
    expect(patchDeskParams(onPage3, { tab: 'topics' }).page).toBe(3);
    expect(patchDeskParams(onPage3, { source: null }).page).toBe(3);
  });

  it('sets an explicit page even alongside a filter change', () => {
    expect(patchDeskParams(onPage3, { q: 'x', page: 2 }).page).toBe(2);
  });

  it('closes the validate mapping on any change', () => {
    expect(
      patchDeskParams(parseDeskParams('tab=validate'), { tab: 'topics' })
        .validate,
    ).toBe(false);
  });
});

describe('clearSourceFilters', () => {
  it('removes search, facets and page and keeps tab and source', () => {
    const params = parseDeskParams(
      'tab=sources&q=css&status=active&stale=feed-dead&cat=Design&tag=x&page=2&source=Lantern%20Notes&tq=edge',
    );
    expect(buildDeskSearch(clearSourceFilters(params))).toBe(
      '?source=Lantern+Notes&tq=edge',
    );
  });
});

describe('clampPage', () => {
  it.each([
    [1, 70, 1],
    [3, 70, 3],
    [4, 70, 3],
    [99, 70, 3],
    [0, 70, 1],
    [-3, 70, 1],
    [2, 0, 1],
    [2, 30, 1],
    [2, 31, 2],
  ])('page %i of %i sources is %i', (page, total, expected) => {
    expect(clampPage(page, total)).toBe(expected);
  });

  it('takes a page size', () => {
    expect(clampPage(5, 25, 10)).toBe(3);
  });
});

describe('historyMode', () => {
  const base = DEFAULT_DESK_PARAMS;

  it('pushes a tab change', () => {
    expect(historyMode(base, { ...base, tab: 'queue' })).toBe('push');
  });

  it('pushes a page change', () => {
    expect(historyMode(base, { ...base, page: 2 })).toBe('push');
  });

  it('pushes opening the pane and replaces closing it', () => {
    const open = { ...base, source: 'Lantern Notes' };
    expect(historyMode(base, open)).toBe('push');
    expect(historyMode(open, { ...open, source: 'Ferry Ops' })).toBe('push');
    expect(historyMode(open, base)).toBe('replace');
  });

  it('replaces search and facet changes, including the page they drop', () => {
    const onPage2 = { ...base, page: 2 };
    expect(historyMode(base, { ...base, q: 'css' })).toBe('replace');
    expect(historyMode(onPage2, patchDeskParams(onPage2, { q: 'css' }))).toBe(
      'replace',
    );
    expect(
      historyMode(onPage2, patchDeskParams(onPage2, { tag: ['devops'] })),
    ).toBe('replace');
  });

  it('replaces topic and queue view changes', () => {
    expect(historyMode(base, { ...base, tstatus: 'proposed' })).toBe('replace');
    expect(historyMode(base, { ...base, sort: 'saved', dir: 'desc' })).toBe(
      'replace',
    );
  });
});
