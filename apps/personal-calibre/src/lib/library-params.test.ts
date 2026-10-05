import { describe, expect, it } from 'vitest';

import {
  activeFilters,
  buildLibraryHref,
  clearFiltersHref,
  filterCount,
  type FilterLabels,
  isDebug,
  parseLibraryParams,
  scopeTitle,
  toLibraryQuery,
} from './library-params';

const labels: FilterLabels = {
  authors: [{ id: 4, name: 'Oren Halvik', sort: 'Halvik, Oren' }],
  tags: [{ id: 6, name: 'winter' }],
  series: [{ id: 3, name: 'Northbound' }],
  platforms: [{ id: 1, key: 'kobo', name: 'Kobo' }],
};

describe('parseLibraryParams', () => {
  it('reads every param', () => {
    expect(
      parseLibraryParams(
        new URLSearchParams(
          'q=salt&author=4&tag=6&series=3&platform=kobo&delivered=false&groupBy=tag&sortBy=added&sortDir=desc&page=2&book=38',
        ),
      ),
    ).toEqual({
      q: 'salt',
      author: 4,
      tag: 6,
      series: 3,
      platform: 'kobo',
      delivered: false,
      groupBy: 'tag',
      sortBy: 'added',
      sortDir: 'desc',
      page: 2,
      book: 38,
    });
  });

  it('defaults an empty URL', () => {
    expect(parseLibraryParams({})).toEqual({
      q: null,
      author: null,
      tag: null,
      series: null,
      platform: null,
      delivered: null,
      groupBy: null,
      sortBy: 'title',
      sortDir: 'asc',
      page: 1,
      book: null,
    });
  });

  it('ignores malformed values', () => {
    const params = parseLibraryParams({
      page: 'abc',
      author: 'abc',
      tag: '-2',
      series: '0',
      groupBy: 'nope',
      sortBy: 'colour',
      sortDir: 'sideways',
      book: '1.5',
      q: '   ',
    });
    expect(params).toMatchObject({
      page: 1,
      author: null,
      tag: null,
      series: null,
      groupBy: null,
      sortBy: 'title',
      sortDir: 'asc',
      book: null,
      q: null,
    });
    expect(parseLibraryParams({ page: '0' }).page).toBe(1);
  });

  it('reads delivered only with a platform, and absent means On', () => {
    expect(parseLibraryParams({ delivered: 'false' }).delivered).toBeNull();
    expect(parseLibraryParams({ platform: 'kobo' }).delivered).toBe(true);
    expect(
      parseLibraryParams({ platform: 'kobo', delivered: 'false' }).delivered,
    ).toBe(false);
  });

  it('takes the first value of a repeated param', () => {
    expect(parseLibraryParams({ author: ['4', '5'] }).author).toBe(4);
  });
});

describe('buildLibraryHref', () => {
  const current = new URLSearchParams(
    'q=salt&page=3&book=38&view=catalogue&__delay=10',
  );

  it('drops page on a filter, sort or group change and keeps everything else', () => {
    expect(buildLibraryHref(current, { author: 4 })).toBe(
      '/?q=salt&book=38&view=catalogue&__delay=10&author=4',
    );
    expect(buildLibraryHref(current, { sortDir: 'desc' })).toBe(
      '/?q=salt&book=38&view=catalogue&__delay=10&sortDir=desc',
    );
    expect(buildLibraryHref(current, { groupBy: 'series' })).toBe(
      '/?q=salt&book=38&view=catalogue&__delay=10&groupBy=series',
    );
  });

  it('keeps book and every other param on a page change', () => {
    expect(buildLibraryHref(current, { page: 2 })).toBe(
      '/?q=salt&page=2&book=38&view=catalogue&__delay=10',
    );
    expect(buildLibraryHref(current, { page: 1 })).toBe(
      '/?q=salt&book=38&view=catalogue&__delay=10',
    );
  });

  it('opens and closes the pane without touching page', () => {
    expect(buildLibraryHref(new URLSearchParams('page=2'), { book: 7 })).toBe(
      '/?page=2&book=7',
    );
    expect(
      buildLibraryHref(new URLSearchParams('page=2&book=7'), { book: null }),
    ).toBe('/?page=2');
  });

  it('writes defaults as absent params', () => {
    const sp = new URLSearchParams(
      'sortBy=added&sortDir=desc&platform=kobo&delivered=false',
    );
    expect(buildLibraryHref(sp, { sortBy: 'title' })).toBe(
      '/?sortDir=desc&platform=kobo&delivered=false',
    );
    expect(buildLibraryHref(sp, { sortDir: 'asc' })).toBe(
      '/?sortBy=added&platform=kobo&delivered=false',
    );
    expect(buildLibraryHref(sp, { delivered: true })).toBe(
      '/?sortBy=added&sortDir=desc&platform=kobo',
    );
    expect(buildLibraryHref(sp, { q: '  ' })).toBe(
      '/?sortBy=added&sortDir=desc&platform=kobo&delivered=false',
    );
  });

  it('drops delivered with the platform', () => {
    expect(
      buildLibraryHref(new URLSearchParams('platform=kobo&delivered=false'), {
        platform: null,
      }),
    ).toBe('/');
  });

  it('accepts a searchParams record from a server page', () => {
    expect(
      buildLibraryHref(
        { groupBy: 'series', sortDir: 'desc', page: '99' },
        { page: 3 },
      ),
    ).toBe('/?groupBy=series&sortDir=desc&page=3');
  });

  it('clears a stale view override without resetting page or book', () => {
    expect(buildLibraryHref(current, { view: null })).toBe(
      '/?q=salt&page=3&book=38&__delay=10',
    );
  });

  it('sets and removes the renderer without touching page', () => {
    expect(buildLibraryHref(current, { renderer: 'css' })).toBe(
      '/?q=salt&page=3&book=38&view=catalogue&__delay=10&renderer=css',
    );
    expect(
      buildLibraryHref(new URLSearchParams('page=2&renderer=three-tsl'), {
        renderer: null,
      }),
    ).toBe('/?page=2');
  });
});

describe('isDebug', () => {
  it('is true for ?debug and ?debug=1', () => {
    expect(isDebug(new URLSearchParams('debug'))).toBe(true);
    expect(isDebug(new URLSearchParams('debug=1'))).toBe(true);
    expect(isDebug({ debug: '' })).toBe(true);
  });

  it('is false otherwise', () => {
    expect(isDebug(new URLSearchParams(''))).toBe(false);
    expect(isDebug(new URLSearchParams('view=study'))).toBe(false);
    expect(isDebug({})).toBe(false);
    expect(isDebug(new URLSearchParams('debug=0'))).toBe(false);
    expect(isDebug(new URLSearchParams('debug=false'))).toBe(false);
  });
});

describe('clearFiltersHref', () => {
  it('removes filters and page, and keeps book, view, groupBy and sort', () => {
    expect(
      clearFiltersHref(
        new URLSearchParams(
          'q=salt&author=4&tag=6&series=3&platform=kobo&delivered=false&page=2&book=38&view=catalogue&groupBy=series&sortDir=desc',
        ),
      ),
    ).toBe('/?book=38&view=catalogue&groupBy=series&sortDir=desc');
  });

  it('keeps renderer and debug, which are not filters', () => {
    expect(
      clearFiltersHref(
        new URLSearchParams('q=salt&tag=6&renderer=css&debug=1&page=2'),
      ),
    ).toBe('/?renderer=css&debug=1');
  });
});

describe('labels', () => {
  it('counts panel filters, not the search', () => {
    expect(
      filterCount(
        parseLibraryParams({ q: 'salt', author: '4', platform: 'kobo' }),
      ),
    ).toBe(2);
  });

  it('names chips and their removal patches', () => {
    const params = parseLibraryParams({
      q: 'salt',
      series: '3',
      author: '4',
      tag: '6',
      platform: 'kobo',
      delivered: 'false',
    });
    expect(activeFilters(params, labels)).toEqual([
      { key: 'q', label: '"salt"', patch: { q: null } },
      { key: 'series', label: 'Series: Northbound', patch: { series: null } },
      { key: 'author', label: 'Author: Oren Halvik', patch: { author: null } },
      { key: 'tag', label: 'Tag: winter', patch: { tag: null } },
      { key: 'platform', label: 'Not on Kobo', patch: { platform: null } },
    ]);
    expect(
      activeFilters(parseLibraryParams({ tag: '99' }), labels)[0]?.label,
    ).toBe('Tag: #99');
  });

  it('titles the scope by precedence', () => {
    expect(scopeTitle(parseLibraryParams({}), labels)).toBe('All books');
    expect(
      scopeTitle(parseLibraryParams({ q: 'salt', series: '3' }), labels),
    ).toBe('Results for "salt"');
    expect(
      scopeTitle(parseLibraryParams({ series: '3', author: '4' }), labels),
    ).toBe('Northbound');
    expect(scopeTitle(parseLibraryParams({ tag: '6' }), labels)).toBe('winter');
    expect(scopeTitle(parseLibraryParams({ platform: 'kobo' }), labels)).toBe(
      'On Kobo',
    );
    expect(
      scopeTitle(
        parseLibraryParams({ platform: 'kobo', delivered: 'false' }),
        labels,
      ),
    ).toBe('Not on Kobo');
  });

  it('maps params to a library query', () => {
    expect(
      toLibraryQuery(
        parseLibraryParams({ tag: '6', groupBy: 'series', page: '2' }),
        30,
      ),
    ).toEqual({
      q: undefined,
      authorId: undefined,
      tagId: 6,
      seriesId: undefined,
      platformKey: undefined,
      delivered: undefined,
      groupBy: 'series',
      sortBy: 'title',
      sortDir: 'asc',
      page: 2,
      pageSize: 30,
    });
  });
});
