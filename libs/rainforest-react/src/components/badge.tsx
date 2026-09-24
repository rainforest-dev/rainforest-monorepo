'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';

import { cn } from '../lib/cn';
import { type BadgeVariantProps, badgeVariants } from './badge-variants';

export type BadgeProps = useRender.ComponentProps<'span'> & BadgeVariantProps;

/** A short status or category label. Status variants map to the success, warning and info tokens. */
export function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: BadgeProps) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  });
}
