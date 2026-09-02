<script setup lang="ts">
import { computed } from 'vue';

import { sprintHeading } from '@/lib/tasksHeader';

// Presentational: the ages are computed by the panel that owns `now`, so this
// component re-renders on the tick without holding a timer of its own.
const props = defineProps<{
  sprintName: string | null;
  /** Full pill sentence, ages included — see lib/tasksHeader.ts. */
  notice: string;
}>();

const heading = computed(() => sprintHeading(props.sprintName));
</script>

<template>
  <div class="flex flex-col gap-2">
    <h1 class="text-foreground text-2xl font-semibold tracking-tight">
      {{ heading.title }}
      <span v-if="heading.suffix" class="text-muted-foreground text-lg">
        {{ heading.suffix }}
      </span>
    </h1>
    <!--
      A warn pill, not a muted caption. The board is a tracker: the sentence is
      the whole point of the row, so it is styled as something to read rather
      than a timestamp to skip.
    -->
    <p
      class="flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] leading-normal"
      :style="{
        color: 'var(--status-warning)',
        borderColor:
          'color-mix(in oklch, var(--status-warning) 45%, transparent)',
        backgroundColor:
          'color-mix(in oklch, var(--status-warning) 14%, transparent)',
      }"
    >
      <span
        class="inline-block size-1.5 shrink-0 rounded-full"
        :style="{ backgroundColor: 'var(--status-warning)' }"
        aria-hidden="true"
      />
      {{ notice }}
    </p>
  </div>
</template>
