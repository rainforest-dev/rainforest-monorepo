import { describe, expect, it } from 'vitest';

import type { Source, StaleType } from '@/lib/registry.types';

import {
  activeChips,
  facetCount,
  facetOptions,
  filterSources,
  hasSourceFilters,
  matchesSearch,
  matchSource,
  type SourceFilters,
  toggleValue,
} from './filters.js';
import { UNCATEGORISED } from './labels.js';
import { clearSourceFilters, DEFAULT_DESK_PARAMS } from './params.js';

function source(
  name: string,
  overrides: Partial<Source> & { staleType?: StaleType } = {},
): Source {
  const { staleType, ...rest } = overrides;
  return {
    name,
    url: `https://feeds.example/${name.toLowerCase().replace(/\W+/g, '-')}.xml`,
    siteUrl: '',
    tags: [],
    status: 'active',
    category: '',
    ...(staleType ? { stale: { type: staleType, note: '' } } : {}),
    ...rest,
  };
}

const SOURCES: Source[] = [
  source('Lantern Notes', {
    category: 'Frontend',
    tags: ['tech/css', 'domain/frontend'],
  }),
  source('Signal Garden', {
    category: 'Frontend',
    tags: ['domain/frontend'],
    staleType: 'feed-dead',
  }),
  source('Ferry Ops', {
    category: 'Infra',
    tags: ['devops'],
    staleType: 'delivery-gap',
  }),
  source('Birch Compiler', { status: 'proposed', tags: ['tech/rust'] }),
  source('Owl Street', {
    status: 'proposed',
    category: 'Writing',
    tags: ['domain/writing'],
    staleType: 'low-value',
  }),
  source('Studio Halcyon', { status: 'no-rss', tags: ['domain/news'] }),
  source('Faded Signals', {
    status: 'retired',
    tags: ['domain/news'],
    staleType: 'feed-dead',
  }),
];

const NONE: SourceFilters = {
  q: '',
  status: [],
  stale: [],
  cat: [],
  tag: [],
};

const filters = (patch: Partial<SourceFilters>): SourceFilters => ({
  ...NONE,
  ...patch,
});

const names = (list: Source[]) => list.map((s) => s.name);

const countOf = (
  facets: ReturnType<typeof facetOptions>,
  key: keyof ReturnType<typeof facetOptions>,
  value: string,
) => facets[key].find((o) => o.value === value)?.count;

describe('matchSource', () => {
  it('matches everything with no filters', () => {
    expect(SOURCES.every((s) => matchSource(s, NONE))).toBe(true);
  });

  it('ORs values within a group', () => {
    const f = filters({ status: ['proposed', 'no-rss'] });
    expect(names(SOURCES.filter((s) => matchSource(s, f)))).toEqual([
      'Birch Compiler',
      'Owl Street',
      'Studio Halcyon',
    ]);
  });

  it('ANDs groups', () => {
    const f = filters({ status: ['active'], cat: ['Frontend'] });
    expect(names(SOURCES.filter((s) => matchSource(s, f)))).toEqual([
      'Lantern Notes',
      'Signal Garden',
    ]);
  });

  it('matches tags as any-of', () => {
    const f = filters({ tag: ['tech/css', 'devops'] });
    expect(names(SOURCES.filter((s) => matchSource(s, f)))).toEqual([
      'Lantern Notes',
      'Ferry Ops',
    ]);
  });

  it('matches the empty category through Uncategorised', () => {
    const f = filters({ cat: [UNCATEGORISED] });
    expect(names(SOURCES.filter((s) => matchSource(s, f)))).toEqual([
      'Birch Compiler',
      'Studio Halcyon',
      'Faded Signals',
    ]);
  });

  it('never matches a retired source on a stale type', () => {
    const f = filters({ stale: ['feed-dead'] });
    expect(names(SOURCES.filter((s) => matchSource(s, f)))).toEqual([
      'Signal Garden',
    ]);
  });

  it('skips one group when asked', () => {
    const f = filters({ status: ['retired'], cat: ['Infra'] });
    expect(matchSource(SOURCES[2], f)).toBe(false);
    expect(matchSource(SOURCES[2], f, 'status')).toBe(true);
  });
});

describe('matchesSearch', () => {
  it.each([
    ['name', 'lantern', 'Lantern Notes'],
    ['feed URL', 'feeds.example/ferry', 'Ferry Ops'],
    ['category', 'writing', 'Owl Street'],
    ['tag', 'tech/rust', 'Birch Compiler'],
  ])('matches the %s, case-insensitively', (_field, q, name) => {
    expect(
      names(SOURCES.filter((s) => matchesSearch(s, q.toUpperCase()))),
    ).toContain(name);
  });

  it('ignores surrounding space and matches everything when empty', () => {
    expect(matchesSearch(SOURCES[0], '  notes ')).toBe(true);
    expect(matchesSearch(SOURCES[0], '   ')).toBe(true);
    expect(matchesSearch(SOURCES[0], 'kernel')).toBe(false);
  });

  it('combines with the facets', () => {
    const f = filters({ q: 'domain/news', status: ['no-rss'] });
    expect(names(filterSources(SOURCES, f))).toEqual(['Studio Halcyon']);
  });
});

describe('facetOptions', () => {
  it('counts every option with no filters, stale skipping retired sources', () => {
    const facets = facetOptions(SOURCES, NONE);
    expect(facets.status.map((o) => [o.label, o.count])).toEqual([
      ['Active', 3],
      ['Proposed', 2],
      ['No RSS', 1],
      ['Retired', 1],
    ]);
    expect(facets.stale.map((o) => [o.label, o.count])).toEqual([
      ['Feed dead', 1],
      ['Delivery gap', 1],
      ['Low value', 1],
      ['Unspecified', 0],
    ]);
  });

  it('lists categories by name with Uncategorised last', () => {
    expect(
      facetOptions(SOURCES, NONE).cat.map((o) => [o.value, o.count]),
    ).toEqual([
      ['Frontend', 2],
      ['Infra', 1],
      ['Writing', 1],
      [UNCATEGORISED, 3],
    ]);
  });

  it('sorts tags by count, then name', () => {
    expect(facetOptions(SOURCES, NONE).tag.map((o) => o.value)).toEqual([
      'domain/frontend',
      'domain/news',
      'devops',
      'domain/writing',
      'tech/css',
      'tech/rust',
    ]);
  });

  it('counts an option against every other group and the search, not its own', () => {
    const f = filters({ status: ['active'], cat: ['Frontend'] });
    const facets = facetOptions(SOURCES, f);
    expect(countOf(facets, 'status', 'active')).toBe(2);
    expect(countOf(facets, 'status', 'proposed')).toBe(0);
    expect(countOf(facets, 'cat', 'Frontend')).toBe(2);
    expect(countOf(facets, 'cat', 'Infra')).toBe(1);
    expect(countOf(facets, 'cat', 'Writing')).toBe(0);
    expect(countOf(facets, 'stale', 'feed-dead')).toBe(1);

    const searched = facetOptions(SOURCES, { ...f, q: 'signal' });
    expect(countOf(searched, 'status', 'active')).toBe(1);
    expect(countOf(searched, 'status', 'retired')).toBe(0);
  });

  it('keeps zero-count options and marks the chosen ones', () => {
    const facets = facetOptions(SOURCES, filters({ stale: ['unspecified'] }));
    const unspecified = facets.stale.find((o) => o.value === 'unspecified');
    expect(unspecified).toEqual({
      value: 'unspecified',
      label: 'Unspecified',
      count: 0,
      selected: true,
    });
    expect(facets.status.every((o) => o.count === 0)).toBe(true);
  });

  it('keeps a chosen category or tag the data no longer has', () => {
    const facets = facetOptions(
      SOURCES,
      filters({ cat: ['Gone'], tag: ['tech/gone'] }),
    );
    expect(facets.cat.at(-1)).toMatchObject({
      value: 'Gone',
      count: 0,
      selected: true,
    });
    expect(facets.tag.at(-1)).toMatchObject({
      value: 'tech/gone',
      selected: true,
    });
  });

  it('omits Uncategorised when every source has a category', () => {
    const categorised = SOURCES.filter((s) => s.category);
    expect(
      facetOptions(categorised, NONE).cat.map((o) => o.value),
    ).not.toContain(UNCATEGORISED);
  });
});

describe('filterSources', () => {
  it('returns the matches in the desk order', () => {
    expect(names(filterSources(SOURCES, NONE))).toEqual([
      'Owl Street',
      'Birch Compiler',
      'Ferry Ops',
      'Signal Garden',
      'Lantern Notes',
      'Studio Halcyon',
      'Faded Signals',
    ]);
  });
});

describe('chips', () => {
  it('makes one chip per search and value, each removing only itself', () => {
    const f = filters({
      q: 'notes',
      status: ['proposed', 'active'],
      stale: ['delivery-gap'],
      cat: [UNCATEGORISED],
      tag: ['tech/css'],
    });
    expect(activeChips(f)).toEqual([
      { key: 'q', label: 'Search: notes', patch: { q: '' } },
      {
        key: 'status:proposed',
        label: 'Status: Proposed',
        patch: { status: ['active'] },
      },
      {
        key: 'status:active',
        label: 'Status: Active',
        patch: { status: ['proposed'] },
      },
      {
        key: 'stale:delivery-gap',
        label: 'Stale: Delivery gap',
        patch: { stale: [] },
      },
      {
        key: `cat:${UNCATEGORISED}`,
        label: `Category: ${UNCATEGORISED}`,
        patch: { cat: [] },
      },
      { key: 'tag:tech/css', label: 'Tag: tech/css', patch: { tag: [] } },
    ]);
    expect(facetCount(f)).toBe(5);
    expect(hasSourceFilters(f)).toBe(true);
  });

  it('has no chips and nothing to clear without filters', () => {
    expect(activeChips(NONE)).toEqual([]);
    expect(hasSourceFilters(NONE)).toBe(false);
    expect(hasSourceFilters(filters({ q: 'x' }))).toBe(true);
  });

  it('Clear all empties every chip', () => {
    const cleared = clearSourceFilters({
      ...DEFAULT_DESK_PARAMS,
      q: 'x',
      tag: ['devops'],
      source: 'Ferry Ops',
    });
    expect(activeChips(cleared)).toEqual([]);
    expect(cleared.source).toBe('Ferry Ops');
  });
});

describe('toggleValue', () => {
  it('adds a missing value at the end and removes a present one', () => {
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
  });
});
