import type { LibraryT } from '@rainforest-dev/library-shell';

import type { Source, StaleType, Topic } from '@/lib/registry.types';

export function sourceStatusLabel(status: Source['status'], t: LibraryT) {
  return t(`status.source.${status}`);
}

export function topicStatusLabel(status: Topic['status'], t: LibraryT) {
  return t(`status.topic.${status}`);
}

export interface StaleCopy {
  label: string;
  hint: string;
  fix: string | null;
}

export function staleCopy(type: StaleType, t: LibraryT): StaleCopy {
  return {
    label: t(`stale.${type}.label`),
    hint: t(`stale.${type}.hint`),
    fix: type === 'unspecified' ? null : t(`stale.${type}.fix`),
  };
}

/** The filter value for sources without a category; shown through `categoryLabel`. */
export const UNCATEGORISED = 'Uncategorised';

export function categoryLabel(value: string, t: LibraryT): string {
  return value === UNCATEGORISED ? t('desk.uncategorised') : value;
}
