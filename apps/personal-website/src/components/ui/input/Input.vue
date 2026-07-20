<script setup lang="ts">
import { cn } from '@/utils/cn';

interface Props {
  label?: string;
  name?: string;
  class?: string;
}

defineProps<Props>();
// The root element is <label>, not <input> — unlike Button.vue's single-root
// case, Vue's default attrs fallthrough would land unlisted attrs/listeners
// (type, placeholder, @keydown, etc.) on the <label>, not the actual field.
// Disable default inheritance and forward explicitly to <input> instead.
defineOptions({ inheritAttrs: false });
const model = defineModel<string>();
</script>

<template>
  <label class="flex flex-col gap-1 text-sm">
    <span v-if="label" class="text-muted-foreground">{{ label }}</span>
    <input
      v-model="model"
      :name="name"
      v-bind="$attrs"
      :class="
        cn(
          'border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2',
          $props.class,
        )
      "
    />
  </label>
</template>
