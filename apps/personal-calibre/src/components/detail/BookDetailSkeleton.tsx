import { Skeleton } from '@rainforest-dev/rainforest-react';

export function BookDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading book"
      className="flex flex-col gap-6 p-4 lg:p-5"
    >
      <div className="flex gap-4">
        <Skeleton className="aspect-[2/3] w-[92px] shrink-0 lg:w-[108px]" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-28" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
