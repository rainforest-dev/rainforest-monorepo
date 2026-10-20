import type { Source, StaleType, Topic } from '@/lib/registry.types';

export const DESK_TABS = ['sources', 'topics', 'queue'] as const;
export type DeskTab = (typeof DESK_TABS)[number];

export const SOURCE_STATUSES = [
  'active',
  'proposed',
  'no-rss',
  'retired',
] as const satisfies readonly Source['status'][];

export const STALE_TYPES = [
  'feed-dead',
  'delivery-gap',
  'low-value',
  'unspecified',
] as const satisfies readonly StaleType[];

export const TOPIC_STATUSES = [
  'proposed',
  'active',
  'declined',
] as const satisfies readonly Topic['status'][];

export const QUEUE_TIERS = [1, 2, 3, 4] as const;
export type QueueTier = (typeof QUEUE_TIERS)[number];

export const QUEUE_SORT_KEYS = [
  'rank',
  'tier',
  'title',
  'decay',
  'minutes',
  'saved',
  'wiki',
  'read',
] as const;
export type QueueSortKey = (typeof QUEUE_SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';

export const SOURCES_PAGE_SIZE = 30;

export interface DeskParams {
  tab: DeskTab;
  validate: boolean;
  q: string;
  status: Source['status'][];
  stale: StaleType[];
  cat: string[];
  tag: string[];
  page: number;
  source: string | null;
  tq: string;
  tstatus: Topic['status'] | null;
  tier: QueueTier | null;
  sort: QueueSortKey;
  dir: SortDir;
}

export const DEFAULT_DESK_PARAMS: DeskParams = {
  tab: 'sources',
  validate: false,
  q: '',
  status: [],
  stale: [],
  cat: [],
  tag: [],
  page: 1,
  source: null,
  tq: '',
  tstatus: null,
  tier: null,
  sort: 'rank',
  dir: 'asc',
};

const FACET_KEYS = ['status', 'stale', 'cat', 'tag'] as const;

function oneOf<T extends string | number>(
  allowed: readonly T[],
  value: string | null,
): T | null {
  return allowed.find((v) => String(v) === value) ?? null;
}

function list(value: string | null): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

function listOf<T extends string>(allowed: readonly T[], value: string | null) {
  return list(value).filter((v): v is T =>
    (allowed as readonly string[]).includes(v),
  );
}

function positiveInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

export function parseDeskParams(input: URLSearchParams | string): DeskParams {
  const sp = typeof input === 'string' ? new URLSearchParams(input) : input;
  const rawTab = sp.get('tab');
  return {
    tab: oneOf(DESK_TABS, rawTab) ?? 'sources',
    validate: rawTab === 'validate',
    q: sp.get('q')?.trim() ?? '',
    status: listOf(SOURCE_STATUSES, sp.get('status')),
    stale: listOf(STALE_TYPES, sp.get('stale')),
    cat: list(sp.get('cat')),
    tag: list(sp.get('tag')),
    page: positiveInt(sp.get('page')) ?? 1,
    source: sp.get('source') || null,
    tq: sp.get('tq')?.trim() ?? '',
    tstatus: oneOf(TOPIC_STATUSES, sp.get('tstatus')),
    tier: oneOf(QUEUE_TIERS, sp.get('tier')),
    sort: oneOf(QUEUE_SORT_KEYS, sp.get('sort')) ?? 'rank',
    dir: sp.get('dir') === 'desc' ? 'desc' : 'asc',
  };
}

export function buildDeskSearch(params: DeskParams): string {
  const sp = new URLSearchParams();
  if (params.tab !== 'sources') sp.set('tab', params.tab);
  if (params.tab === 'sources') {
    if (params.q) sp.set('q', params.q);
    for (const key of FACET_KEYS) {
      if (params[key].length > 0) sp.set(key, params[key].join(','));
    }
    if (params.page > 1) sp.set('page', String(params.page));
    if (params.source) sp.set('source', params.source);
  } else if (params.tab === 'topics') {
    if (params.tq) sp.set('tq', params.tq);
    if (params.tstatus) sp.set('tstatus', params.tstatus);
  } else {
    if (params.tier) sp.set('tier', String(params.tier));
    if (params.sort !== 'rank') sp.set('sort', params.sort);
    if (params.dir !== 'asc') sp.set('dir', params.dir);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export type DeskPatch = Partial<Omit<DeskParams, 'validate'>>;

const DROPS_PAGE: readonly (keyof DeskPatch)[] = ['q', ...FACET_KEYS];

export function patchDeskParams(
  params: DeskParams,
  patch: DeskPatch,
): DeskParams {
  const next: DeskParams = { ...params, ...patch, validate: false };
  const keys = Object.keys(patch) as (keyof DeskPatch)[];
  if (!keys.includes('page') && keys.some((k) => DROPS_PAGE.includes(k)))
    next.page = 1;
  return next;
}

export function clearSourceFilters(params: DeskParams): DeskParams {
  return {
    ...params,
    validate: false,
    q: '',
    status: [],
    stale: [],
    cat: [],
    tag: [],
    page: 1,
  };
}

export function clampPage(
  page: number,
  total: number,
  pageSize = SOURCES_PAGE_SIZE,
): number {
  const last = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, Math.floor(page)), last);
}

export type HistoryMode = 'push' | 'replace';

export function historyMode(prev: DeskParams, next: DeskParams): HistoryMode {
  if (prev.tab !== next.tab) return 'push';
  if (prev.page !== next.page && !sameFilters(prev, next)) return 'replace';
  if (prev.page !== next.page) return 'push';
  if (next.source !== null && prev.source !== next.source) return 'push';
  return 'replace';
}

function sameFilters(a: DeskParams, b: DeskParams): boolean {
  return (
    a.q === b.q && FACET_KEYS.every((k) => a[k].join(',') === b[k].join(','))
  );
}
