'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { CheckIcon, MinusIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/cn';

/** A box that marks one option on or off, with an indeterminate state for "some". */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border outline-none transition-colors after:absolute after:-inset-x-3 after:-inset-y-2',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="group/indicator grid place-content-center text-current transition-none [&>svg]:size-3.5"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            {state.indeterminate ? <MinusIcon /> : <CheckIcon />}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

export type CheckboxProps = React.ComponentProps<typeof Checkbox>;
