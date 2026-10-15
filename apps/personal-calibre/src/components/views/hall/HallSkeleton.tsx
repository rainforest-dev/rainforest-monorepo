import { Skeleton } from '@rainforest-dev/rainforest-react';

export function HallSkeleton() {
  return (
    <Skeleton
      data-hall-skeleton
      className="h-[min(70dvh,640px)] w-full rounded-lg lg:h-[min(78dvh,760px)]"
    />
  );
}
