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
  <!-- One scrolling strip below `sm`, the wrapping row it always was above it.
       Measured at 390px: the four groups are 261, 287, 119 and 179 wide, so
       wrapping puts them on FOUR rows -- 157px, on top of a 100px heading, so
       the first card sat at 396px and 47% of the screen was chrome before any
       task. Shrinking the chips would have fitted two rows and taken the tap
       targets below 32px, which is the wrong thing to trade on a phone. A strip
       keeps every target its size and costs one row. -->
  <div
    class="lo-scroll -mx-1 flex flex-nowrap items-center gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:justify-between sm:overflow-visible sm:px-0 sm:pb-0"
  >
    <!-- shrink-0 on every group. In a nowrap strip a flex item still SHRINKS
         below its content, and without this the view chips were drawn on top of
         "Personal 20" -- overlapping text, not a scroll. -->
    <div class="flex shrink-0 flex-nowrap items-center gap-4 sm:flex-wrap">
      <div
        class="flex shrink-0 flex-nowrap items-center gap-1.5 sm:flex-wrap"
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
        class="flex shrink-0 flex-nowrap items-center gap-1.5 sm:flex-wrap"
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

      <p
        class="text-muted-foreground shrink-0 whitespace-nowrap font-mono text-[11px] tabular-nums"
      >
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
