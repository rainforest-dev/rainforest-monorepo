import type { Source, Stale } from '@/lib/registry.types';

export function visibleStale(
  source: Pick<Source, 'status' | 'stale'>,
): Stale | undefined {
  return source.status === 'retired' ? undefined : source.stale;
}
