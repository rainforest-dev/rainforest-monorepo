'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import {
  type ToggleVariantProps,
  toggleVariants,
} from '@rainforest-dev/rainforest-ui/recipes';
import * as React from 'react';

import { cn } from '../lib/cn';

const ToggleGroupContext = React.createContext<ToggleVariantProps>({
  variant: 'default',
  size: 'default',
});

/** A row of pressable buttons; one pressed at a time, or several with `multiple`. */
function ToggleGroup({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}: ToggleGroupPrimitive.Props & ToggleVariantProps) {
  const context = React.useMemo(() => ({ variant, size }), [variant, size]);
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        'group/toggle-group data-vertical:flex-col data-vertical:items-stretch flex w-fit items-center gap-1',
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={context}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem({
  className,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & ToggleVariantProps) {
  const context = React.useContext(ToggleGroupContext);
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        toggleVariants({
          variant: variant ?? context.variant,
          size: size ?? context.size,
        }),
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
export { toggleVariants };

export type ToggleGroupProps = React.ComponentProps<typeof ToggleGroup>;
