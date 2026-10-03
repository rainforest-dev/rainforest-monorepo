import type { Source } from '@/lib/registry.types';

import { visibleStale } from './stale';

const STATUS_ORDER: Record<Source['status'], number> = {
  proposed: 0,
  active: 1,
  'no-rss': 2,
  retired: 3,
};

const showsStale = (source: Source): boolean =>
  visibleStale(source) !== undefined;

export function compareSources(a: Source, b: Source): number {
  return (
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    Number(showsStale(b)) - Number(showsStale(a)) ||
    a.name.localeCompare(b.name, 'en')
  );
}
