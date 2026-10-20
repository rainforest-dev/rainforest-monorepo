import { cn, Skeleton } from '@rainforest-dev/rainforest-react';

import type { DeskTab } from '@/lib/desk';

const ROWS: Record<DeskTab, number> = { sources: 12, topics: 8, queue: 10 };
const PHONE_ROWS: Record<DeskTab, number> = {
  sources: 7,
  topics: 8,
  queue: 10,
};

export function TabSkeleton({ tab }: { tab: DeskTab }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="flex flex-col gap-2"
    >
      {Array.from({ length: ROWS[tab] }, (_, i) => (
        <div
          key={i}
          className={cn(
            'flex h-10 items-center gap-4 border-b px-2',
            i >= PHONE_ROWS[tab] && 'max-lg:hidden',
          )}
        >
          <Skeleton className="h-4 w-48 max-lg:flex-1" />
          <Skeleton className="h-4 w-24 max-lg:hidden" />
          <Skeleton className="h-4 flex-1 max-lg:hidden" />
          <Skeleton className="rounded-4xl h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
