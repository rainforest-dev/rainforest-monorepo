<script setup lang="ts">
import { LayoutGrid, Network } from '@lucide/vue';
import { computed } from 'vue';

import { SORT_MODES, type SortMode } from '@/lib/taskSort';

export type ScopeFilter = 'all' | 'work' | 'personal';
export type TaskView = 'board' | 'graph';

export interface ScopeOption {
  key: ScopeFilter;
  label: string;
  count: number;
}

const props = defineProps<{
  scopeOptions: ScopeOption[];
  taskCount: number;
  pointsTotal: number;
}>();

// Genuine two-way contracts: the panel owns the state, this bar is its control
// surface. Nothing here is derived from the other two.
const scope = defineModel<ScopeFilter>('scope', { required: true });
const sortMode = defineModel<SortMode>('sortMode', { required: true });
const view = defineModel<TaskView>('view', { required: true });

// Chip classes are shared by three rows, so they are derived once here rather
// than repeated as ternaries in the template.
const CHIP_BASE =
  'inline-flex min-h-8 shrink-0 items-center gap-1.5 border px-3.5 transition-colors';
const ACTIVE = 'border-primary/45 bg-primary/15 text-primary';
const IDLE = 'border-border text-muted-foreground hover:text-foreground';

function chip(active: boolean, shape: string): string {
  return `${CHIP_BASE} ${shape} ${active ? ACTIVE : IDLE}`;
}

/** `All 33` / `Work 26` / `Personal 7` — the count belongs in the label. */
const scopeChips = computed(() =>
  props.scopeOptions.map((opt) => ({
    ...opt,
    text: `${opt.label} ${opt.count}`,
    class: chip(scope.value === opt.key, 'rounded-full font-mono text-[11px]'),
  })),
);

const sortChips = computed(() =>
  SORT_MODES.map((opt) => ({
    ...opt,
    class: chip(sortMode.value === opt.id, 'rounded-md text-[13px]'),
  })),
);

const VIEW_OPTIONS = [
  { id: 'board' as const, label: 'Board', icon: LayoutGrid },
  { id: 'graph' as const, label: 'Graph', icon: Network },
];

const viewChips = computed(() =>
  VIEW_OPTIONS.map((opt) => ({
    ...opt,
    class: chip(view.value === opt.id, 'rounded-md text-[13px]'),
  })),
);
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-4">
      <div
        class="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Filter tasks by scope"
      >
        <button
          v-for="opt in scopeChips"
          :key="opt.key"
          type="button"
          :class="opt.class"
          :aria-pressed="scope === opt.key"
          @click="scope = opt.key"
        >
          {{ opt.text }}
        </button>
      </div>

      <!-- Sort is Board-only: a graph has no column order to apply it to. -->
      <div
        v-if="view === 'board'"
        class="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Sort board columns"
      >
        <button
          v-for="opt in sortChips"
          :key="opt.id"
          type="button"
          :class="opt.class"
          :aria-pressed="sortMode === opt.id"
          @click="sortMode = opt.id"
        >
          {{ opt.label }}
        </button>
      </div>

      <p class="text-muted-foreground font-mono text-[11px] tabular-nums">
        {{ taskCount }} tasks · {{ pointsTotal }} pts
      </p>
    </div>

    <div
      class="flex shrink-0 items-center gap-1.5"
      role="group"
      aria-label="Switch task view"
    >
      <button
        v-for="opt in viewChips"
        :key="opt.id"
        type="button"
        :class="opt.class"
        :aria-pressed="view === opt.id"
        @click="view = opt.id"
      >
        <component :is="opt.icon" class="size-3.5" aria-hidden="true" />
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
