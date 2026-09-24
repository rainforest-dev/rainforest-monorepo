import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '../lib/cn';

export const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'border-destructive/40 bg-destructive/10 text-destructive *:data-[slot=alert-description]:text-destructive/90',
        success:
          'border-success/40 bg-success/10 text-success *:data-[slot=alert-description]:text-foreground',
        warning:
          'border-warning/40 bg-warning/15 text-warning *:data-[slot=alert-description]:text-foreground',
        info: 'border-info/40 bg-info/10 text-info *:data-[slot=alert-description]:text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type AlertProps = React.ComponentProps<'div'> &
  VariantProps<typeof alertVariants>;

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
