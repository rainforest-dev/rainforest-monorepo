import type * as React from 'react';

import { cn } from '../lib/cn';

/** A pulsing placeholder block shown while content loads. Size it with `className`. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        'bg-muted animate-pulse rounded-md motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };

export type SkeletonProps = React.ComponentProps<typeof Skeleton>;
