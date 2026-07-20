<script setup lang="ts">
import type { SelectContentEmits, SelectContentProps } from 'reka-ui';
import {
  SelectContent,
  SelectPortal,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectViewport,
  useForwardPropsEmits,
} from 'reka-ui';
import { ChevronDown, ChevronUp } from '@lucide/vue';

import { cn } from '@/utils/cn';

const props = defineProps<SelectContentProps & { class?: string }>();
const emits = defineEmits<SelectContentEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SelectPortal>
    <SelectContent
      v-bind="forwarded"
      :position="props.position ?? 'popper'"
      :side-offset="props.sideOffset ?? 6"
      :class="
        cn(
          'border-border bg-popover text-popover-foreground relative z-50 min-w-32 overflow-hidden rounded-md border shadow-md',
          props.position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          props.class,
        )
      "
    >
      <SelectScrollUpButton class="flex items-center justify-center py-1">
        <ChevronUp class="h-4 w-4" />
      </SelectScrollUpButton>
      <SelectViewport class="p-1">
        <slot />
      </SelectViewport>
      <SelectScrollDownButton class="flex items-center justify-center py-1">
        <ChevronDown class="h-4 w-4" />
      </SelectScrollDownButton>
    </SelectContent>
  </SelectPortal>
</template>
