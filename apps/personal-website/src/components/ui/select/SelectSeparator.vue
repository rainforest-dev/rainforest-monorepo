<script setup lang="ts">
import type { SelectSeparatorProps } from 'reka-ui';
import { SelectSeparator } from 'reka-ui';

import { cn } from '@/utils/cn';

const props = defineProps<SelectSeparatorProps & { class?: string }>();
</script>

<template>
  <SelectSeparator
    v-bind="props"
    :class="cn('bg-border -mx-1 my-1 h-px', props.class)"
  />
</template>
