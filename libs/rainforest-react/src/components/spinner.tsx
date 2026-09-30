import { Loader2Icon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/cn';

/** A spinning indicator for a pending action. Put it inside the Button whose request is running. */
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn(
        'size-4 animate-spin motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };

export type SpinnerProps = React.ComponentProps<typeof Spinner>;
