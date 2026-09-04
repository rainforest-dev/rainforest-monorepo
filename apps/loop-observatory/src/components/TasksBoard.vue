<script setup lang="ts">
import { Bot, Check, Circle, ExternalLink, Hand } from '@lucide/vue';
import { computed } from 'vue';

// Type-only: keep the client bundle free of tasks.ts's node:fs/node:path deps
// (mirrors MachinesPanel's type-only import of budget.ts).
import type { SprintTask } from '@/lib/tasks';
import {
  DEFAULT_SORT_MODE,
  SORT_COMPARATORS,
  type SortMode,
} from '@/lib/taskSort';
import {
  ALWAYS_SHOWN_COLUMNS,
  BOARD_COLUMNS,
  boardColumn,
  boardColumnColor,
  columnOwner,
  loopStageLabel,
  outboxChip,
  ownerMeta,
  priorityColor,
  scopeBadge,
  statusColor,
  statusSoftBg,
  taskOwner,
} from '@/lib/taskStatus';

const props = withDefaults(
  defineProps<{
    tasks: SprintTask[];
    statuses: string[];
    sortMode?: SortMode;
  }>(),
  { sortMode: DEFAULT_SORT_MODE },
);
// Clicking a card opens the in-app note drawer (not the external Notion link).
const emit = defineEmits<{ select: [task: SprintTask] }>();

interface Column {
  status: string;
  color: string;
  cards: SprintTask[];
  points: number;
}

// One column per BOARD_COLUMNS (the dashboard's own owner-split list), grouped
// by the task's board column. Empty columns drop unless part of the always-shown
// active middle. `props.statuses` still arrives for the loop-pill logic.
const columns = computed<Column[]>(() => {
  const byColumn = new Map<string, SprintTask[]>();
  for (const t of props.tasks) {
    const col = boardColumn(t.status, t.loopStatus);
    const list = byColumn.get(col) ?? [];
    list.push(t);
    byColumn.set(col, list);
  }

  // Render BOARD_COLUMNS in order, then any unmapped column actually present in
  // the data (a renamed/new Notion status) appended, so no task silently vanishes.
  const extra = [...byColumn.keys()].filter((c) => !BOARD_COLUMNS.includes(c));
  const out: Column[] = [];
  for (const status of [...BOARD_COLUMNS, ...extra]) {
    const cards = (byColumn.get(status) ?? [])
      .slice()
      .sort(SORT_COMPARATORS[props.sortMode]);
    if (cards.length === 0 && !ALWAYS_SHOWN_COLUMNS.includes(status)) continue;
    out.push({
      status,
      color: boardColumnColor(status),
      cards,
      points: cards.reduce((sum, c) => sum + (c.points ?? 0), 0),
    });
  }
  return out;
});

// Lucide icon per owner for the column header + card chip.
const OWNER_ICON = { ai: Bot, you: Hand, done: Check, parked: Circle } as const;
</script>

<template>
  <!-- Columns side by side from `sm` up, stacked below it.
       A horizontal board on a 390px screen shows ONE 288px column and puts the
       rest off-frame with nothing saying they are there -- and the row is as
       tall as its tallest column, so the page measured 5430px, six and a half
       screens, nearly all of it the empty space beside a short column. Stacking
       turns that into what a phone is good at: one thing, then the next. -->
  <div
    class="lo-scroll -mx-1 flex flex-col gap-4 px-1 pb-3.5 sm:flex-row sm:overflow-x-auto"
  >
    <section
      v-for="col in columns"
      :key="col.status"
      class="flex w-full flex-col sm:w-72 sm:shrink-0"
    >
      <!-- Column header: status • count • summed points -->
      <div class="mb-2 flex items-center gap-2 px-1">
        <component
          :is="OWNER_ICON[columnOwner(col.status)]"
          class="size-3.5 shrink-0"
          :style="{ color: col.color }"
          aria-hidden="true"
        />
        <span
          class="inline-block size-2.5 shrink-0 rounded-full"
          :style="{ backgroundColor: col.color }"
          aria-hidden="true"
        />
        <h3 class="text-foreground truncate text-sm font-semibold">
          {{ col.status }}
        </h3>
        <span
          class="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums"
        >
          {{ col.cards.length
          }}<template v-if="col.points > 0"> · {{ col.points }} pts</template>
        </span>
      </div>

      <div class="flex flex-col gap-2">
        <div
          v-for="card in col.cards"
          :key="card.id ?? card.name"
          role="button"
          tabindex="0"
          class="bg-card border-border hover:border-foreground/30 focus-visible:ring-ring block w-full cursor-pointer rounded-lg border border-l-4 p-3 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
          :style="{
            borderLeftColor: ownerMeta(taskOwner(card.status, card.loopStatus))
              .color,
          }"
          @click="emit('select', card)"
          @keydown.enter="emit('select', card)"
          @keydown.space.prevent="emit('select', card)"
        >
          <div class="mb-1.5 flex items-center gap-2">
            <span
              class="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums"
            >
              #{{ card.id ?? '—' }}
            </span>
            <span
              class="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium"
              :style="{
                color: ownerMeta(taskOwner(card.status, card.loopStatus)).color,
                backgroundColor: statusSoftBg(col.status),
              }"
              :title="`Owner: ${ownerMeta(taskOwner(card.status, card.loopStatus)).label}`"
            >
              <component
                :is="OWNER_ICON[taskOwner(card.status, card.loopStatus)]"
                class="size-2.5"
                aria-hidden="true"
              />
              {{ ownerMeta(taskOwner(card.status, card.loopStatus)).label }}
            </span>
            <span
              v-if="card.priority"
              class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
              :style="{
                color: priorityColor(card.priority) ?? undefined,
                backgroundColor: statusSoftBg(col.status),
              }"
            >
              {{ card.priority }}
            </span>
            <span
              class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
              :style="{
                color: scopeBadge(card.scope).color,
                backgroundColor: scopeBadge(card.scope).bg,
              }"
            >
              {{ scopeBadge(card.scope).label }}
            </span>
            <!-- Loop-tracked marker: this status came from the loop, not Notion -->
            <span
              v-if="card.loopStatus"
              class="text-muted-foreground/80 shrink-0 text-[9px] font-medium"
              title="Status tracked by the loop"
            >
              ◆ loop
            </span>
            <!-- Greenlight-relay state: must precede the hasFeedback dot, which
                 uses ml-auto to pin itself to the right edge. -->
            <span
              v-if="outboxChip(card.outboxState)"
              class="shrink-0 rounded px-1 text-[9px] font-medium"
              :style="{ color: outboxChip(card.outboxState)!.color }"
              :title="outboxChip(card.outboxState)!.title"
            >
              {{ outboxChip(card.outboxState)!.label }}
            </span>
            <span
              v-if="card.hasFeedback"
              class="ml-auto inline-block size-2 shrink-0 rounded-full"
              :style="{ backgroundColor: 'var(--status-warning)' }"
              title="Feedback awaiting tuning"
              aria-label="Feedback awaiting tuning"
            />
          </div>

          <p
            class="text-foreground line-clamp-2 text-sm font-medium leading-snug"
          >
            {{ card.name }}
          </p>

          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              v-if="card.points != null"
              class="text-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            >
              {{ card.points }} pts
            </span>
            <!-- Loop sub-state pill (e.g. "PR ready", "Spec drafted", "Needs
                 tuning"): the precise loop state, finer than the card's column. -->
            <span
              v-if="loopStageLabel(card.loopStatus, statuses)"
              class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
              :style="{
                color: statusColor(card.loopStatus!),
                backgroundColor: statusSoftBg(card.loopStatus!),
              }"
            >
              {{ loopStageLabel(card.loopStatus, statuses) }}
            </span>
            <a
              v-if="card.pr"
              :href="card.pr"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary inline-flex shrink-0 items-center gap-0.5 rounded text-[10px] font-medium hover:underline"
              title="Open pull request"
              @click.stop
            >
              PR <ExternalLink class="size-2.5" />
            </a>
            <span
              v-if="card.component"
              class="text-muted-foreground border-border truncate rounded border px-1.5 py-0.5 text-[10px]"
            >
              {{ card.component }}
            </span>
            <span
              v-if="card.epic"
              class="text-muted-foreground/80 min-w-0 truncate text-[10px] italic"
              :title="card.epic.name"
            >
              {{ card.epic.name }}
            </span>
          </div>
        </div>

        <p
          v-if="col.cards.length === 0"
          class="text-muted-foreground/70 border-border rounded-lg border border-dashed px-3 py-6 text-center text-xs"
        >
          No cards
        </p>
      </div>
    </section>
  </div>
</template>
