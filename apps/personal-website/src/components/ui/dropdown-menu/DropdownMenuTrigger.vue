<script setup lang="ts">
import type { DropdownMenuTriggerProps } from 'reka-ui';
import { DropdownMenuTrigger } from 'reka-ui';

defineProps<DropdownMenuTriggerProps & { class?: string }>();
</script>

<template>
  <DropdownMenuTrigger :class="$props.class" as-child>
    <slot />
  </DropdownMenuTrigger>
</template>
