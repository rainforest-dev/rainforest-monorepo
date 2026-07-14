<script lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
</script>

<script setup lang="ts">
import { cn } from '@/utils/cn';

interface Props {
  variant?: BadgeVariant;
  class?: string;
}

withDefaults(defineProps<Props>(), { variant: 'default' });
</script>

<template>
  <span :class="cn(badgeVariants({ variant }), $props.class)">
    <slot />
  </span>
</template>
