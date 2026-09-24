import {
  type AlertVariantProps,
  alertVariants,
} from '@rainforest-dev/rainforest-ui/recipes';
import type * as React from 'react';

import { cn } from '../lib/cn';

export type AlertProps = React.ComponentProps<'div'> & AlertVariantProps;

/** An inline notice. Use a status variant for results, warnings and errors. */
export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        '[&_a]:underline-offset-3 [&_a]:hover:text-foreground font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline',
        className,
      )}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-muted-foreground [&_a]:underline-offset-3 [&_a]:hover:text-foreground text-balance text-sm md:text-pretty [&_a]:underline [&_p:not(:last-child)]:mb-4',
        className,
      )}
      {...props}
    />
  );
}

export function AlertAction({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-action"
      className={cn('absolute right-2 top-2', className)}
      {...props}
    />
  );
}

export { alertVariants };
