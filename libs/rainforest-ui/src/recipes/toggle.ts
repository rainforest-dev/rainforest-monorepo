import { cva, type VariantProps } from 'class-variance-authority';

/** Class recipe behind `ToggleGroupItem`. */
export const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 data-pressed:bg-muted data-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-input bg-transparent',
      },
      size: {
        default: 'h-8 min-w-8 px-2',
        sm: 'h-7 min-w-7 rounded-md px-1.5 text-xs',
        lg: 'h-9 min-w-9 px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ToggleVariantProps = VariantProps<typeof toggleVariants>;
