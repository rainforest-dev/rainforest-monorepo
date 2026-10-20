import { Skeleton } from '@rainforest-dev/rainforest-react';

import { spineDims } from '@/lib';

const BAYS = [0, 1, 2];
const SPINES = [0, 1, 2, 3, 4, 5, 6];

export function StudySkeleton() {
  return (
    <div className="st-case">
      {BAYS.map((r) => (
        <div key={r} data-skeleton-bay className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-[18px] w-36" />
          <div className="st-bay">
            <div className="st-row">
              {SPINES.map((i) => {
                const { width, height } = spineDims(i + r);
                return (
                  <Skeleton
                    key={i}
                    className="shrink-0 rounded-[3px]"
                    style={{
                      width: `calc(${width}px * var(--st-k))`,
                      height: `calc(${height}px * var(--st-k))`,
                    }}
                  />
                );
              })}
            </div>
            <div className="st-board" />
          </div>
        </div>
      ))}
    </div>
  );
}
