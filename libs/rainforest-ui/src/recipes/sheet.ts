import { cva, type VariantProps } from 'class-variance-authority';

/** Class recipe behind `SheetContent`. */
export const sheetContentVariants = cva(
  'fixed z-50 flex flex-col gap-4 bg-popover text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] data-swiping:duration-0 data-swiping:select-none motion-reduce:duration-150',
  {
    variants: {
      side: {
        right:
          'inset-y-0 right-0 h-full w-3/4 translate-x-(--drawer-swipe-movement-x) sm:max-w-sm data-starting-style:translate-x-full data-ending-style:translate-x-full',
        left: 'inset-y-0 left-0 h-full w-3/4 translate-x-(--drawer-swipe-movement-x) sm:max-w-sm data-starting-style:-translate-x-full data-ending-style:-translate-x-full',
        bottom:
          'inset-x-0 bottom-0 h-[calc(100dvh-5rem)] translate-y-[calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px))] rounded-t-xl data-starting-style:translate-y-full data-ending-style:translate-y-full',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
);

export type SheetContentVariantProps = VariantProps<
  typeof sheetContentVariants
>;
