'use client';

import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';
import type * as React from 'react';

import { cn } from '../lib/cn';

/** A hairline between panels, groups or menu sections. */
function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        'bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch shrink-0',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };

export type SeparatorProps = React.ComponentProps<typeof Separator>;
