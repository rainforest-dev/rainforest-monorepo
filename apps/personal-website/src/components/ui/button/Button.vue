<script lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
export type ButtonSize = VariantProps<typeof buttonVariants>['size'];
</script>

<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '@/utils/cn';

interface Props {
  variant?: ButtonVariant;
  size?: ButtonSize;
  as?: string;
  href?: string;
  target?: string;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  as: 'button',
});

// A target="_blank" link without rel="noopener noreferrer" lets the opened
// page access window.opener (a security/perf footgun) — apply it automatically
// so callers don't have to remember it every time.
const rel = computed(() =>
  props.target === '_blank' ? 'noopener noreferrer' : undefined,
);
</script>

<template>
  <!-- Single root, default inheritAttrs: non-declared attributes (e.g. a
       caller's data-* hooks) fall through onto this element automatically.
       If this component ever grows a second root node or sets
       inheritAttrs: false, that fallthrough breaks silently — forward
       $attrs explicitly to this element if either of those ever changes. -->
  <component
    :is="href ? 'a' : as"
    :href="href || undefined"
    :target="target || undefined"
    :rel="rel"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </component>
</template>
