'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';

import { cn } from '../lib/cn';
import { type ButtonVariantProps, buttonVariants } from './button-variants';

export type ButtonProps = ButtonPrimitive.Props & ButtonVariantProps;

/** The primary action control. Pick `variant` for emphasis and `size` for density. */
export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
