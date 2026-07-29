<script setup lang="ts">
import { cn } from '@/utils/cn';

const props = defineProps<{ class?: string }>();
</script>

<template>
  <div
    :class="
      cn(
        'bg-card text-card-foreground border-border rounded-lg border shadow-sm',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
