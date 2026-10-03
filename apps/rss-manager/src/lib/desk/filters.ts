import type { Source, StaleType } from '@/lib/registry.types';

import { SOURCE_STATUS_LABEL, STALE_COPY, UNCATEGORISED } from './labels';
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

export const FACET_TITLE: Record<FacetKey, string> = {
  status: 'Status',
  stale: 'Stale',
  cat: 'Category',
  tag: 'Tags',
};

const CHIP_PREFIX: Record<FacetKey, string> = {
  status: 'Status',
  stale: 'Stale',
  cat: 'Category',
  tag: 'Tag',
};

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
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [source.name, source.url, source.category, ...source.tags].some(
    (field) => field.toLowerCase().includes(needle),
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
      label: optionLabel(key, value),
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

export function optionLabel(key: FacetKey, value: string): string {
  if (key === 'status')
    return SOURCE_STATUS_LABEL[value as Source['status']] ?? value;
  if (key === 'stale') return STALE_COPY[value as StaleType]?.label ?? value;
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

export function activeChips(filters: SourceFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.q)
    chips.push({ key: 'q', label: `Search: ${filters.q}`, patch: { q: '' } });
  for (const key of FACET_KEYS) {
    const chosen: readonly string[] = filters[key];
    for (const value of chosen) {
      chips.push({
        key: `${key}:${value}`,
        label: `${CHIP_PREFIX[key]}: ${optionLabel(key, value)}`,
        patch: { [key]: chosen.filter((v) => v !== value) },
      });
    }
  }
  return chips;
}
