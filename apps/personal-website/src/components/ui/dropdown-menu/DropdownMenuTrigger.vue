<script setup lang="ts">
import type { DropdownMenuTriggerProps } from 'reka-ui';
import { DropdownMenuTrigger, useForwardProps } from 'reka-ui';

const props = defineProps<DropdownMenuTriggerProps & { class?: string }>();
const forwarded = useForwardProps(props);
</script>

<template>
  <!-- as-child always renders this component's slot's single child element
       (e.g. a Button) as the actual trigger — do not pass text or multiple
       children, since there's nothing else for reka-ui to attach the
       open/close handlers and ARIA attributes to. -->
  <DropdownMenuTrigger v-bind="forwarded" :class="$props.class" as-child>
    <slot />
  </DropdownMenuTrigger>
</template>
