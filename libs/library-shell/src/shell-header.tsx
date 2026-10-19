import { cn } from '@rainforest-dev/rainforest-react';
import { type ComponentProps } from 'react';

import { SHELL_TRANSITION_NAMES } from './ids';

/** The sticky top bar every collection shares: 56px on desktop, wrapping on narrow screens. */
export function ShellHeader({
  className,
  style,
  ...props
}: ComponentProps<'header'>) {
  return (
    <header
      data-slot="shell-header"
      className={cn(
        'bg-background sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2 lg:h-14 lg:flex-nowrap lg:px-4 lg:py-0',
        className,
      )}
      style={{ viewTransitionName: SHELL_TRANSITION_NAMES.header, ...style }}
      {...props}
    />
  );
}
