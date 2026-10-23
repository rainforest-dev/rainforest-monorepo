'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { useCallback } from 'react';

import type { Wing } from '@/lib';
import { HALL_NAMESPACE } from '@/locales';
import { useHall } from '@/providers';

/** The line under a wing's sign that counts its items with no answer for this grouping. */
export function useUnsortedNote(): (wing: Wing) => string | null {
  const { groupBy } = useHall();
  const t = useLibraryT(HALL_NAMESPACE);
  return useCallback(
    (wing) =>
      groupBy === 'collection' || wing.unsorted === 0
        ? null
        : t(`wing.unsorted.${groupBy}`, { count: wing.unsorted }),
    [groupBy, t],
  );
}
