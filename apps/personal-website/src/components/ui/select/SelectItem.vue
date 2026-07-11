<script setup lang="ts">
import type { SelectItemEmits, SelectItemProps } from 'reka-ui';
import {
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  useForwardPropsEmits,
} from 'reka-ui';
import { Check } from '@lucide/vue';

import { cn } from '@/utils/cn';

const props = defineProps<SelectItemProps & { class?: string }>();
const emits = defineEmits<SelectItemEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SelectItem
    v-bind="forwarded"
    :class="
      cn(
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )
    "
  >
    <span
      class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center"
    >
      <SelectItemIndicator>
        <Check class="h-4 w-4" />
      </SelectItemIndicator>
    </span>
    <SelectItemText>
      <slot />
    </SelectItemText>
  </SelectItem>
</template>
