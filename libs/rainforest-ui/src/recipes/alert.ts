import { cva, type VariantProps } from 'class-variance-authority';

/** Class recipe behind `Alert`. */
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

export type AlertVariantProps = VariantProps<typeof alertVariants>;
