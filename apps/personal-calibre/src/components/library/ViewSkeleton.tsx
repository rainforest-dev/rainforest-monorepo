'use client';

import { Skeleton } from '@rainforest-dev/rainforest-react';

import { cn } from '@/lib/utils';

import { useLibrary } from './LibraryProvider';

export function ViewSkeleton() {
  const { view } = useLibrary();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading books"
      data-skeleton={view}
      className="py-4"
    >
      {view === 'catalogue' ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton
              key={i}
              className={cn('h-12 w-full', i >= 7 && 'hidden lg:block')}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className={cn('flex flex-col gap-2', i >= 6 && 'hidden lg:flex')}
            >
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
