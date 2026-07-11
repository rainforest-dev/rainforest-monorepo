<script setup lang="ts">
import type { SelectTriggerProps } from 'reka-ui';
import { SelectIcon, SelectTrigger, useForwardProps } from 'reka-ui';
import { ChevronDown } from '@lucide/vue';

import { cn } from '@/utils/cn';

const props = defineProps<SelectTriggerProps & { class?: string }>();
const forwarded = useForwardProps(props);
</script>

<template>
  <SelectTrigger
    v-bind="forwarded"
    :class="
      cn(
        'border-input bg-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
        props.class,
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
    </SelectIcon>
  </SelectTrigger>
</template>
