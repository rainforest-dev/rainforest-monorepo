<script setup lang="ts">
import type { SelectLabelProps } from 'reka-ui';
import { SelectLabel } from 'reka-ui';

import { cn } from '@/utils/cn';

const props = defineProps<SelectLabelProps & { class?: string }>();
</script>

<template>
  <SelectLabel
    v-bind="props"
    :class="
      cn('text-muted-foreground px-2 py-1.5 text-xs font-medium', props.class)
    "
  >
    <slot />
  </SelectLabel>
</template>
