<script setup lang="ts">
import { ChevronDown } from '@lucide/vue';
import { ref } from 'vue';

import { Card } from '@/components/ui/card';

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    count?: number | string | null;
    defaultOpen?: boolean;
    /** Max height of the (scrollable) body so heavy sections don't dominate. */
    maxHeight?: string;
  }>(),
  { defaultOpen: true, maxHeight: '26rem' },
);

const open = ref(props.defaultOpen);
</script>

<template>
  <Card>
    <button
      type="button"
      class="hover:bg-muted/40 flex w-full items-center gap-3 rounded-t-lg px-6 py-4 text-left transition-colors"
      :aria-expanded="open"
      @click="open = !open"
    >
      <ChevronDown
        class="text-muted-foreground size-4 shrink-0 transition-transform"
        :class="open ? '' : '-rotate-90'"
      />
      <div class="min-w-0">
        <h3 class="text-foreground font-semibold leading-none tracking-tight">
          {{ title }}
        </h3>
        <p v-if="description" class="text-muted-foreground mt-1 text-sm">
          {{ description }}
        </p>
      </div>
      <span
        v-if="count != null"
        class="text-muted-foreground ml-auto shrink-0 text-sm tabular-nums"
      >
        {{ count }}
      </span>
    </button>

    <div
      v-show="open"
      class="overflow-y-auto px-6 pb-6"
      :style="{ maxHeight }"
    >
      <slot />
    </div>
  </Card>
</template>
