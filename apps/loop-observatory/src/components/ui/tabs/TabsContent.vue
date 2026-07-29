<script setup lang="ts">
import type { TabsContentProps } from 'reka-ui';
import { TabsContent } from 'reka-ui';
import { cn } from '@/utils/cn';

const props = defineProps<TabsContentProps & { class?: string }>();
</script>

<template>
  <TabsContent
    v-bind="props"
    :class="cn('mt-4 focus-visible:outline-none', props.class)"
  >
    <slot />
  </TabsContent>
</template>
