<script setup lang="ts">
import type { TabsListProps } from 'reka-ui';
import { TabsList } from 'reka-ui';
import { cn } from '@/utils/cn';

const props = defineProps<TabsListProps & { class?: string }>();
</script>

<template>
  <TabsList
    v-bind="props"
    :class="
      cn(
        'bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-md p-1',
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
