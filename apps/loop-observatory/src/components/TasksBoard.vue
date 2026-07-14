<script setup lang="ts">
import { computed } from 'vue';

// Type-only: keep the client bundle free of tasks.ts's node:fs/node:path deps
// (mirrors MachinesPanel's type-only import of budget.ts).
import type { SprintTask } from '@/lib/tasks';
import {
  ALWAYS_SHOWN_STATUSES,
  priorityColor,
  scopeBadge,
  statusColor,
  statusSoftBg,
} from '@/lib/taskStatus';

const props = defineProps<{ tasks: SprintTask[]; statuses: string[] }>();
// Clicking a card opens the in-app note drawer (not the external Notion link).
const emit = defineEmits<{ select: [task: SprintTask] }>();

interface Column {
  status: string;
  color: string;
  cards: SprintTask[];
  points: number;
}

// One column per status in board order. Empty columns are dropped unless they
// are part of the always-shown active middle (Not started → Done).
const columns = computed<Column[]>(() => {
  const byStatus = new Map<string, SprintTask[]>();
  for (const t of props.tasks) {
    const list = byStatus.get(t.status) ?? [];
    list.push(t);
    byStatus.set(t.status, list);
  }

  const out: Column[] = [];
  for (const status of props.statuses) {
    const cards = (byStatus.get(status) ?? []).slice().sort((a, b) => a.order - b.order);
    if (cards.length === 0 && !ALWAYS_SHOWN_STATUSES.includes(status)) continue;
    out.push({
      status,
      color: statusColor(status),
      cards,
      points: cards.reduce((sum, c) => sum + (c.points ?? 0), 0),
    });
  }
  return out;
});
</script>

<template>
  <!-- The column row scrolls horizontally on narrow widths; the page never does. -->
  <div class="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
    <section
      v-for="col in columns"
      :key="col.status"
      class="flex w-72 shrink-0 flex-col"
    >
      <!-- Column header: status • count • summed points -->
      <div class="mb-2 flex items-center gap-2 px-1">
        <span
          class="inline-block size-2.5 shrink-0 rounded-full"
          :style="{ backgroundColor: col.color }"
          aria-hidden="true"
        />
        <h3 class="text-foreground truncate text-sm font-semibold">{{ col.status }}</h3>
        <span class="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
          {{ col.cards.length }}<template v-if="col.points > 0"> · {{ col.points }} pts</template>
        </span>
      </div>

      <div class="flex flex-col gap-2">
        <button
          v-for="card in col.cards"
          :key="card.id ?? card.name"
          type="button"
          class="bg-card border-border hover:border-foreground/30 focus-visible:ring-ring group block w-full rounded-lg border border-l-4 p-3 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
          :style="{ borderLeftColor: col.color }"
          @click="emit('select', card)"
        >
          <div class="mb-1.5 flex items-center gap-2">
            <span class="text-muted-foreground shrink-0 font-mono text-[11px] tabular-nums">
              #{{ card.id ?? '—' }}
            </span>
            <span
              v-if="card.priority"
              class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
              :style="{
                color: priorityColor(card.priority) ?? undefined,
                backgroundColor: statusSoftBg(card.status),
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
          </div>

          <p class="text-foreground line-clamp-2 text-sm font-medium leading-snug">
            {{ card.name }}
          </p>

          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              v-if="card.points != null"
              class="text-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
            >
              {{ card.points }} pts
            </span>
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
        </button>

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
