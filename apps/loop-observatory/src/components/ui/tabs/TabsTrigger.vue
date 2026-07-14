<script setup lang="ts">
import type { TabsTriggerProps } from 'reka-ui';
import { TabsTrigger } from 'reka-ui';
import { cn } from '@/utils/cn';

const props = defineProps<TabsTriggerProps & { class?: string }>();
</script>

<template>
  <TabsTrigger
    v-bind="props"
    :class="
      cn(
        'data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
