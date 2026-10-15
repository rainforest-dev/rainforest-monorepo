'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { canUseWebGL2 } from '@/components/views/study/capabilities';
import { useReducedMotion } from '@/hooks';
import {
  type Bookcase,
  bookcasePatch,
  buildHall,
  GROUP_BYS,
  type GroupBy,
  type HallBook,
  layoutHall,
} from '@/lib';
import { useLibrary } from '@/providers';
import type { FilterOptions } from '@/types';

import { CssHall } from './CssHall';
import { HallBoundary } from './HallBoundary';
import { HallSkeleton } from './HallSkeleton';
import { LoadThreeHall } from './three/loadThreeHall';

export interface HallViewProps {
  books: readonly HallBook[];
  filters: FilterOptions;
  groupBy: GroupBy;
}

export function HallView({ books, filters, groupBy }: HallViewProps) {
  const { enterBookcase, hallReturn, studyFallback } = useLibrary();
  const reducedMotion = useReducedMotion();
  const [three, setThree] = useState<boolean | null>(null);
  useEffect(() => setThree(!studyFallback && canUseWebGL2()), [studyFallback]);

  const cases = useMemo(
    () => buildHall(books, filters, groupBy),
    [books, filters, groupBy],
  );
  // Sized for the grouping with the most bookcases, so switching grouping moves books, not furniture.
  const layout = useMemo(
    () =>
      layoutHall(
        Math.max(...GROUP_BYS.map((g) => buildHall(books, filters, g).length)),
      ),
    [books, filters],
  );
  const onEnter = useCallback(
    (bookcase: Bookcase) =>
      enterBookcase(bookcase, bookcasePatch(bookcase, groupBy)),
    [enterBookcase, groupBy],
  );

  return (
    <div
      data-hall
      data-hall-mode={three === null ? undefined : three ? '3d' : 'css'}
    >
      {three === null ? (
        <HallSkeleton />
      ) : three ? (
        <HallBoundary fallback={<CssHall cases={cases} onEnter={onEnter} />}>
          <CssHall cases={cases} onEnter={onEnter} hidden />
          <LoadThreeHall
            books={books}
            cases={cases}
            layout={layout}
            startKey={hallReturn?.key ?? null}
            reducedMotion={reducedMotion}
            onEnter={onEnter}
          />
        </HallBoundary>
      ) : (
        <CssHall cases={cases} onEnter={onEnter} />
      )}
    </div>
  );
}
