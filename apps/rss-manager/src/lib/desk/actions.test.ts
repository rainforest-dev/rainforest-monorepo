import { describe, expect, it } from 'vitest';

import type { Source, StaleType, Topic } from '@/lib/registry.types';

import {
  applicableNames,
  canActivate,
  canActivateTopic,
  canDeclineTopic,
  canResubscribe,
  canRetire,
  notApplicableNote,
  pageCheckState,
  toggleName,
  withNames,
  withoutNames,
  writeFailure,
  writeSummary,
} from './actions.js';

const STATUSES: Source['status'][] = [
  'active',
  'proposed',
  'no-rss',
  'retired',
];
const STALE: (StaleType | undefined)[] = [
  undefined,
  'feed-dead',
  'delivery-gap',
  'low-value',
  'unspecified',
];

const cases = STATUSES.flatMap((status) =>
  STALE.map((type) => ({
    status,
    type,
    source: {
      status,
      stale: type ? { type, note: '' } : undefined,
    } satisfies Pick<Source, 'status' | 'stale'>,
  })),
);

describe('source rules', () => {
  it.each(cases)('activate: $status, stale $type', ({ status, source }) => {
    expect(canActivate(source)).toBe(
      status === 'proposed' || status === 'retired',
    );
  });

  it.each(cases)('retire: $status, stale $type', ({ status, type, source }) => {
    expect(canRetire(source)).toBe(
      status !== 'retired' && type !== 'delivery-gap',
    );
  });

  it.each(cases)(
    're-subscribe: $status, stale $type',
    ({ status, type, source }) => {
      expect(canResubscribe(source)).toBe(
        status === 'active' && type === 'delivery-gap',
      );
    },
  );
});

describe('topic rules', () => {
  it.each<[Topic['status'], boolean, boolean]>([
    ['proposed', true, true],
    ['declined', true, false],
    ['active', false, false],
  ])('%s: activate %s, decline %s', (status, activate, decline) => {
    expect(canActivateTopic({ status })).toBe(activate);
    expect(canDeclineTopic({ status })).toBe(decline);
  });
});

const source = (
  name: string,
  status: Source['status'],
  stale?: StaleType,
): Source => ({
  name,
  url: `https://example.test/${name}`,
  siteUrl: '',
  tags: [],
  status,
  category: '',
  stale: stale ? { type: stale, note: '' } : undefined,
});

const REGISTRY: Source[] = [
  source('Proposed one', 'proposed'),
  source('Proposed two', 'proposed'),
  source('Active plain', 'active'),
  source('Active gap', 'active', 'delivery-gap'),
  source('Active low', 'active', 'low-value'),
  source('No feed', 'no-rss'),
  source('Retired one', 'retired'),
  source('Retired dead', 'retired', 'feed-dead'),
];

describe('applicable counts', () => {
  it('counts only the selected sources each action applies to', () => {
    const selection = new Set([
      'Proposed one',
      'Active gap',
      'Active low',
      'No feed',
      'Retired dead',
    ]);
    expect(applicableNames(REGISTRY, selection, 'activate')).toEqual([
      'Proposed one',
      'Retired dead',
    ]);
    expect(applicableNames(REGISTRY, selection, 'retire')).toEqual([
      'Proposed one',
      'Active low',
      'No feed',
    ]);
  });

  it('counts selected sources wherever they sit, not only the page shown', () => {
    const page = REGISTRY.slice(0, 2);
    const selection = new Set(['Proposed two', 'Retired one']);
    expect(
      pageCheckState(
        selection,
        page.map((s) => s.name),
      ),
    ).toBe('some');
    expect(applicableNames(REGISTRY, selection, 'activate')).toEqual([
      'Proposed two',
      'Retired one',
    ]);
  });

  it('ignores selected names that are no longer in the registry', () => {
    const selection = new Set(['Gone', 'Proposed one']);
    expect(applicableNames(REGISTRY, selection, 'activate')).toEqual([
      'Proposed one',
    ]);
  });

  it('counts a duplicated name once, as the server acts on the first', () => {
    const registry = [source('Twin', 'proposed'), source('Twin', 'active')];
    expect(applicableNames(registry, new Set(['Twin']), 'retire')).toEqual([
      'Twin',
    ]);
  });

  it('is empty when nothing selected applies', () => {
    const selection = new Set(['Active gap']);
    expect(applicableNames(REGISTRY, selection, 'activate')).toEqual([]);
    expect(applicableNames(REGISTRY, selection, 'retire')).toEqual([]);
  });

  it('says why a bulk action applies to none', () => {
    expect(notApplicableNote('activate')).toBe(
      'None of the selected sources can be activated. Activate applies to proposed and retired sources.',
    );
    expect(notApplicableNote('retire')).toContain('without a delivery gap');
  });
});

describe('selection helpers', () => {
  const page = ['a', 'b', 'c'];

  it('reports the header checkbox state for the page', () => {
    expect(pageCheckState(new Set(), page)).toBe('none');
    expect(pageCheckState(new Set(['x']), page)).toBe('none');
    expect(pageCheckState(new Set(['a', 'x']), page)).toBe('some');
    expect(pageCheckState(new Set(['a', 'b', 'c', 'x']), page)).toBe('all');
  });

  it('toggles one name without touching the rest', () => {
    const start = new Set(['a', 'x']);
    expect([...toggleName(start, 'b')]).toEqual(['a', 'x', 'b']);
    expect([...toggleName(start, 'a')]).toEqual(['x']);
    expect([...start]).toEqual(['a', 'x']);
  });

  it('adds and removes a page while keeping names from other pages', () => {
    const start = new Set(['x', 'a']);
    expect([...withNames(start, page)]).toEqual(['x', 'a', 'b', 'c']);
    expect([...withoutNames(new Set(['x', ...page]), page)]).toEqual(['x']);
  });
});

describe('write messages', () => {
  it('names a single source and counts several', () => {
    expect(writeSummary('activate', ['Paper Cartography'])).toBe(
      'Activated Paper Cartography',
    );
    expect(writeSummary('retire', ['a', 'b', 'c'])).toBe('Retired 3 sources');
    expect(writeFailure('retire', ['a', 'b', 'c'])).toBe(
      "Couldn't retire 3 sources",
    );
    expect(writeFailure('activate', ['Kite & Key'])).toBe(
      "Couldn't activate Kite & Key",
    );
  });
});
