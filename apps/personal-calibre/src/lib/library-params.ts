import type { LibraryQuery } from '@/lib/server';
import type { DeliveryPlatform, FilterOptions } from '@/types';

import type { View } from './prefs';

export const PAGE_SIZE = 30;

export const GROUP_BYS = ['series', 'tag', 'author'] as const;
export type GroupBy = (typeof GROUP_BYS)[number];
export const SORT_BYS = [
  'title',
  'author',
  'added',
  'pubdate',
  'rating',
] as const;
export type SortBy = (typeof SORT_BYS)[number];
export type SortDir = 'asc' | 'desc';

export interface LibraryParams {
  q: string | null;
  author: number | null;
  tag: number | null;
  series: number | null;
  platform: string | null;
  delivered: boolean | null;
  groupBy: GroupBy | null;
  sortBy: SortBy;
  sortDir: SortDir;
  page: number;
  book: number | null;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;
export type SearchParamsInput = URLSearchParams | RawSearchParams;

export interface ParamPatch {
  q?: string | null;
  author?: number | null;
  tag?: number | null;
  series?: number | null;
  platform?: string | null;
  delivered?: boolean | null;
  groupBy?: GroupBy | null;
  sortBy?: SortBy | null;
  sortDir?: SortDir | null;
  page?: number | null;
  book?: number | null;
  view?: View | null;
}

const RESETS_PAGE: ReadonlyArray<keyof ParamPatch> = [
  'q',
  'author',
  'tag',
  'series',
  'platform',
  'delivered',
  'groupBy',
  'sortBy',
  'sortDir',
];
const FILTER_PARAMS = ['q', 'author', 'tag', 'series', 'platform', 'delivered'];

export function toSearchParams(input: SearchParamsInput): URLSearchParams {
  if (input instanceof URLSearchParams)
    return new URLSearchParams(input.toString());
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) out.append(key, first);
  }
  return out;
}

function positiveInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 ? n : null;
}

function oneOf<T extends string>(
  allowed: readonly T[],
  value: string | null,
): T | null {
  return allowed.find((v) => v === value) ?? null;
}

export function parseLibraryParams(input: SearchParamsInput): LibraryParams {
  const sp = toSearchParams(input);
  const platform = sp.get('platform') || null;
  return {
    q: sp.get('q')?.trim() || null,
    author: positiveInt(sp.get('author')),
    tag: positiveInt(sp.get('tag')),
    series: positiveInt(sp.get('series')),
    platform,
    delivered: platform ? sp.get('delivered') !== 'false' : null,
    groupBy: oneOf(GROUP_BYS, sp.get('groupBy')),
    sortBy: oneOf(SORT_BYS, sp.get('sortBy')) ?? 'title',
    sortDir: sp.get('sortDir') === 'desc' ? 'desc' : 'asc',
    page: positiveInt(sp.get('page')) ?? 1,
    book: positiveInt(sp.get('book')),
  };
}

function isDefault(key: keyof ParamPatch, value: unknown): boolean {
  return (
    (key === 'delivered' && value === true) ||
    (key === 'sortBy' && value === 'title') ||
    (key === 'sortDir' && value === 'asc') ||
    (key === 'page' && typeof value === 'number' && value <= 1) ||
    (key === 'q' && typeof value === 'string' && value.trim() === '')
  );
}

function hrefOf(sp: URLSearchParams): string {
  const qs = sp.toString();
  return qs ? `/?${qs}` : '/';
}

export function buildLibraryHref(
  current: SearchParamsInput,
  patch: ParamPatch,
): string {
  const sp = toSearchParams(current);
  const keys = Object.keys(patch) as Array<keyof ParamPatch>;
  for (const key of keys) {
    const value = patch[key];
    if (value === null || value === undefined || isDefault(key, value))
      sp.delete(key);
    else sp.set(key, key === 'q' ? String(value).trim() : String(value));
  }
  if (patch.platform === null) sp.delete('delivered');
  if (keys.some((k) => RESETS_PAGE.includes(k)) && !keys.includes('page'))
    sp.delete('page');
  return hrefOf(sp);
}

export function clearFiltersHref(current: SearchParamsInput): string {
  const sp = toSearchParams(current);
  for (const key of [...FILTER_PARAMS, 'page']) sp.delete(key);
  return hrefOf(sp);
}

export function filterCount(params: LibraryParams): number {
  return [params.author, params.tag, params.series, params.platform].filter(
    (v) => v !== null,
  ).length;
}

export function hasFilters(params: LibraryParams): boolean {
  return params.q !== null || filterCount(params) > 0;
}

export interface FilterLabels {
  authors: FilterOptions['authors'];
  tags: FilterOptions['tags'];
  series: FilterOptions['series'];
  platforms: DeliveryPlatform[];
}

export interface ActiveFilter {
  key: 'q' | 'author' | 'tag' | 'series' | 'platform';
  label: string;
  patch: ParamPatch;
}

function nameOf(
  options: ReadonlyArray<{ id: number; name: string | null }>,
  id: number,
): string {
  return options.find((o) => o.id === id)?.name ?? `#${id}`;
}

function platformPhrase(params: LibraryParams, labels: FilterLabels): string {
  const name =
    labels.platforms.find((p) => p.key === params.platform)?.name ??
    params.platform;
  return `${params.delivered === false ? 'Not on' : 'On'} ${name}`;
}

export function activeFilters(
  params: LibraryParams,
  labels: FilterLabels,
): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (params.q)
    out.push({ key: 'q', label: `"${params.q}"`, patch: { q: null } });
  if (params.series) {
    out.push({
      key: 'series',
      label: `Series: ${nameOf(labels.series, params.series)}`,
      patch: { series: null },
    });
  }
  if (params.author) {
    out.push({
      key: 'author',
      label: `Author: ${nameOf(labels.authors, params.author)}`,
      patch: { author: null },
    });
  }
  if (params.tag) {
    out.push({
      key: 'tag',
      label: `Tag: ${nameOf(labels.tags, params.tag)}`,
      patch: { tag: null },
    });
  }
  if (params.platform) {
    out.push({
      key: 'platform',
      label: platformPhrase(params, labels),
      patch: { platform: null },
    });
  }
  return out;
}

export function scopeTitle(
  params: LibraryParams,
  labels: FilterLabels,
): string {
  if (params.q) return `Results for "${params.q}"`;
  if (params.series) return nameOf(labels.series, params.series);
  if (params.author) return nameOf(labels.authors, params.author);
  if (params.tag) return nameOf(labels.tags, params.tag);
  if (params.platform) return platformPhrase(params, labels);
  return 'All books';
}

export function toLibraryQuery(
  params: LibraryParams,
  pageSize: number,
): LibraryQuery {
  return {
    q: params.q ?? undefined,
    authorId: params.author ?? undefined,
    tagId: params.tag ?? undefined,
    seriesId: params.series ?? undefined,
    platformKey: params.platform ?? undefined,
    delivered: params.delivered ?? undefined,
    groupBy: params.groupBy ?? undefined,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    page: params.page,
    pageSize,
  };
}
