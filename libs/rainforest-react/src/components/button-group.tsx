'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import {
  type ButtonGroupVariantProps,
  buttonGroupVariants,
} from '@rainforest-dev/rainforest-ui/recipes';
import type * as React from 'react';

import { cn } from '../lib/cn';
import { Separator } from './separator';

/** Joins controls that act as one, such as a select and its action, into a single bordered group. */
function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<'div'> & ButtonGroupVariantProps) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

function ButtonGroupText({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(
          "bg-muted flex items-center gap-2 rounded-lg border px-2.5 text-sm font-medium [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'button-group-text',
    },
  });
}

function ButtonGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        'bg-input data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto relative self-stretch',
        className,
      )}
      {...props}
    />
  );
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText };

export type ButtonGroupProps = React.ComponentProps<typeof ButtonGroup>;

export { buttonGroupVariants };
