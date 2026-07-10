<script setup lang="ts">
import type { DropdownMenuSeparatorProps } from 'reka-ui';
import { DropdownMenuSeparator } from 'reka-ui';

import { cn } from '@/utils/cn';

const props = defineProps<DropdownMenuSeparatorProps & { class?: string }>();
</script>

<template>
  <DropdownMenuSeparator
    v-bind="props"
    :class="cn('bg-border -mx-1 my-1 h-px', props.class)"
  />
</template>
