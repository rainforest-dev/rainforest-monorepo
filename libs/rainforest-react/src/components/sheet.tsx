'use client';

import { Drawer as SheetPrimitive } from '@base-ui/react/drawer';
import {
  type SheetContentVariantProps,
  sheetContentVariants,
} from '@rainforest-dev/rainforest-ui/recipes';
import { XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Button } from './button';

type SheetSide = NonNullable<SheetContentVariantProps['side']>;

const SWIPE_DIRECTION = {
  right: 'right',
  left: 'left',
  bottom: 'down',
} as const satisfies Record<SheetSide, string>;

const SheetSideContext = React.createContext<SheetSide>('right');

/** A panel that slides in from an edge; on `side="bottom"`, `snapPoints` add a peek height. */
function Sheet({
  side = 'right',
  swipeDirection,
  ...props
}: SheetPrimitive.Root.Props & { side?: SheetSide }) {
  return (
    <SheetSideContext.Provider value={side}>
      <SheetPrimitive.Root
        data-slot="sheet"
        swipeDirection={swipeDirection ?? SWIPE_DIRECTION[side]}
        {...props}
      />
    </SheetSideContext.Provider>
  );
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        'supports-backdrop-filter:backdrop-blur-xs data-starting-style:opacity-0 data-ending-style:opacity-0 bg-foreground/10 fixed inset-0 z-50 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-300',
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  showOverlay = true,
  showCloseButton = true,
  showHandle,
  ...props
}: SheetPrimitive.Popup.Props & {
  showOverlay?: boolean;
  showCloseButton?: boolean;
  showHandle?: boolean;
}) {
  const side = React.useContext(SheetSideContext);
  return (
    <SheetPortal>
      {showOverlay && <SheetOverlay />}
      <SheetPrimitive.Viewport
        data-slot="sheet-viewport"
        className="pointer-events-none fixed inset-0 z-50"
      >
        <SheetPrimitive.Popup
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            'pointer-events-auto',
            sheetContentVariants({ side }),
            className,
          )}
          {...props}
        >
          {(showHandle ?? side === 'bottom') && (
            <div
              data-slot="sheet-handle"
              aria-hidden
              className="bg-muted-foreground/30 mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full"
            />
          )}
          {children}
          {showCloseButton && (
            <SheetPrimitive.Close
              data-slot="sheet-close"
              render={
                <Button
                  variant="ghost"
                  className="absolute right-3 top-3"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Popup>
      </SheetPrimitive.Viewport>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1 p-4', className)}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: SheetPrimitive.Content.Props) {
  return (
    <SheetPrimitive.Content
      data-slot="sheet-body"
      className={cn(
        'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4',
        className,
      )}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        'font-heading text-foreground text-base font-medium',
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
export { sheetContentVariants };

export type SheetProps = React.ComponentProps<typeof Sheet>;
