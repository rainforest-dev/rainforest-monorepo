'use client';

import type * as React from 'react';

import { cn } from '../lib/cn';

/** A control's visible name. Point `htmlFor` at the control, or wrap it. */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- callers pass htmlFor or wrap the control; the rule cannot see through the prop spread
    <label
      data-slot="label"
      className={cn(
        'flex select-none items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };

export type LabelProps = React.ComponentProps<typeof Label>;
