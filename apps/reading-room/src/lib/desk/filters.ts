import type { LibraryT } from '@rainforest-dev/library-shell';
import { matchesAllTerms, whitespaceTerms } from '@rainforest-dev/search';

import type { Source, StaleType } from '@/lib/registry.types';

import {
  categoryLabel,
  sourceStatusLabel,
  staleCopy,
  UNCATEGORISED,
} from './labels';
import {
  type DeskParams,
  type DeskPatch,
  SOURCE_STATUSES,
  STALE_TYPES,
} from './params';
import { compareSources } from './sort';
import { visibleStale } from './stale';

export type SourceFilters = Pick<
  DeskParams,
  'q' | 'status' | 'stale' | 'cat' | 'tag'
>;

export type FacetKey = 'status' | 'stale' | 'cat' | 'tag';

export function facetTitle(key: FacetKey, t: LibraryT): string {
  return t(`filter.facet.${key}`);
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  selected: boolean;
}

export type Facets = Record<FacetKey, FacetOption[]>;

export interface FilterChip {
  key: string;
  label: string;
  patch: DeskPatch;
}

export function categoryValue(source: Pick<Source, 'category'>): string {
  return source.category || UNCATEGORISED;
}

export function matchesSearch(source: Source, q: string): boolean {
  return matchesAllTerms(
    [source.name, source.url, source.category, ...source.tags],
    whitespaceTerms(q),
  );
}

function hasOption(key: FacetKey, value: string, source: Source): boolean {
  switch (key) {
    case 'status':
      return source.status === value;
    case 'stale':
      return visibleStale(source)?.type === value;
    case 'cat':
      return categoryValue(source) === value;
    case 'tag':
      return source.tags.includes(value);
  }
}

function inGroup(key: FacetKey, filters: SourceFilters, source: Source) {
  const chosen: readonly string[] = filters[key];
  return (
    chosen.length === 0 || chosen.some((value) => hasOption(key, value, source))
  );
}

const FACET_KEYS: readonly FacetKey[] = ['status', 'stale', 'cat', 'tag'];

export function matchSource(
  source: Source,
  filters: SourceFilters,
  except?: FacetKey,
): boolean {
  return (
    matchesSearch(source, filters.q) &&
    FACET_KEYS.every((key) => key === except || inGroup(key, filters, source))
  );
}

export function filterSources(
  sources: readonly Source[],
  filters: SourceFilters,
): Source[] {
  return sources.filter((s) => matchSource(s, filters)).sort(compareSources);
}

function categoryValues(sources: readonly Source[]): string[] {
  const named = new Set(sources.map((s) => s.category).filter(Boolean));
  const sorted = [...named].sort((a, b) => a.localeCompare(b, 'en'));
  return sources.some((s) => !s.category) ? [...sorted, UNCATEGORISED] : sorted;
}

function tagValues(sources: readonly Source[]): string[] {
  const totals = new Map<string, number>();
  for (const tag of sources.flatMap((s) => s.tags))
    totals.set(tag, (totals.get(tag) ?? 0) + 1);
  return [...totals.keys()].sort(
    (a, b) =>
      (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b, 'en'),
  );
}

export function facetOptions(
  sources: readonly Source[],
  filters: SourceFilters,
  t: LibraryT,
): Facets {
  const values: Record<FacetKey, readonly string[]> = {
    status: SOURCE_STATUSES,
    stale: STALE_TYPES,
    cat: categoryValues(sources),
    tag: tagValues(sources),
  };
  const options = (key: FacetKey): FacetOption[] => {
    const chosen: readonly string[] = filters[key];
    const known = values[key];
    const all = [...known, ...chosen.filter((v) => !known.includes(v))];
    const pool = sources.filter((s) => matchSource(s, filters, key));
    return all.map((value) => ({
      value,
      label: optionLabel(key, value, t),
      count: pool.filter((s) => hasOption(key, value, s)).length,
      selected: chosen.includes(value),
    }));
  };
  return {
    status: options('status'),
    stale: options('stale'),
    cat: options('cat'),
    tag: options('tag'),
  };
}

const SOURCE_STATUS_SET: ReadonlySet<string> = new Set(SOURCE_STATUSES);
const STALE_TYPE_SET: ReadonlySet<string> = new Set(STALE_TYPES);

export function optionLabel(key: FacetKey, value: string, t: LibraryT): string {
  if (key === 'status')
    return SOURCE_STATUS_SET.has(value)
      ? sourceStatusLabel(value as Source['status'], t)
      : value;
  if (key === 'stale')
    return STALE_TYPE_SET.has(value)
      ? staleCopy(value as StaleType, t).label
      : value;
  if (key === 'cat') return categoryLabel(value, t);
  return value;
}

export function toggleValue<T extends string>(
  list: readonly T[],
  value: T,
): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function facetCount(filters: SourceFilters): number {
  return FACET_KEYS.reduce((n, key) => n + filters[key].length, 0);
}

export function hasSourceFilters(filters: SourceFilters): boolean {
  return filters.q !== '' || facetCount(filters) > 0;
}

export function activeChips(filters: SourceFilters, t: LibraryT): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({
      key: 'q',
      label: t('filter.search', { q: filters.q }),
      patch: { q: '' },
    });
  for (const key of FACET_KEYS) {
    const chosen: readonly string[] = filters[key];
    for (const value of chosen) {
      chips.push({
        key: `${key}:${value}`,
        label: t('filter.chipLabel', {
          prefix: t(`filter.chip.${key}`),
          value: optionLabel(key, value, t),
        }),
        patch: { [key]: chosen.filter((v) => v !== value) },
      });
    }
  }
  return chips;
}
