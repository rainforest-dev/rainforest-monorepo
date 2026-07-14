<script setup lang="ts">
import { KanbanSquare, LayoutGrid, Workflow } from '@lucide/vue';
import { useNow } from '@vueuse/core';
import { formatDistanceToNowStrict } from 'date-fns';
import { computed, ref } from 'vue';

import TasksBoard from '@/components/TasksBoard.vue';
import TasksFlow from '@/components/TasksFlow.vue';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SprintTask, TasksData } from '@/lib/tasks';

const props = defineProps<{ tasks: TasksData | null }>();

// Relative "synced" label re-renders on this tick.
const now = useNow({ interval: 30_000 });

const hasTasks = computed(() => (props.tasks?.tasks.length ?? 0) > 0);

// Scope filter shared by both the Board and the Flow views.
type ScopeFilter = 'all' | 'work' | 'personal';
const scopeFilter = ref<ScopeFilter>('all');

const allTasks = computed<SprintTask[]>(() => props.tasks?.tasks ?? []);

const scopeOptions = computed<{ key: ScopeFilter; label: string; count: number }[]>(() => [
  { key: 'all', label: 'All', count: allTasks.value.length },
  { key: 'work', label: 'Work', count: allTasks.value.filter((t) => t.scope === 'work').length },
  {
    key: 'personal',
    label: 'Personal',
    count: allTasks.value.filter((t) => t.scope === 'personal').length,
  },
]);

const filteredTasks = computed<SprintTask[]>(() =>
  scopeFilter.value === 'all'
    ? allTasks.value
    : allTasks.value.filter((t) => t.scope === scopeFilter.value),
);

const filteredPoints = computed(() =>
  filteredTasks.value.reduce((sum, t) => sum + (t.points ?? 0), 0),
);

const syncedLabel = computed<string | null>(() => {
  void now.value; // recompute on tick
  const iso = props.tasks?.synced_at;
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return `synced ${formatDistanceToNowStrict(new Date(t), { addSuffix: true })}`;
});
</script>

<template>
  <section>
    <div class="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      <KanbanSquare class="text-muted-foreground size-4" />
      <h2 class="text-foreground text-lg font-semibold tracking-tight">Sprint tasks</h2>
      <span v-if="tasks?.sprint" class="text-muted-foreground text-sm">
        {{ tasks.sprint.name }}
      </span>
      <span v-if="syncedLabel" class="text-muted-foreground/80 ml-auto text-xs">
        {{ syncedLabel }}
      </span>
    </div>

    <Card>
      <CardContent class="p-4 sm:p-6">
        <div
          v-if="!hasTasks"
          class="text-muted-foreground flex items-center justify-center rounded-md border border-dashed px-4 py-10 text-sm"
        >
          No sprint tasks yet — populate
          <code class="text-foreground mx-1">_system/usage/tasks.json</code>
          from the Notion board.
        </div>

        <Tabs v-else default-value="board">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-3">
              <!-- Scope segmented control: filters both views. -->
              <div
                class="bg-muted inline-flex items-center gap-0.5 rounded-md p-1"
                role="group"
                aria-label="Filter tasks by scope"
              >
                <button
                  v-for="opt in scopeOptions"
                  :key="opt.key"
                  type="button"
                  :aria-pressed="scopeFilter === opt.key"
                  class="inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-sm font-medium transition-colors"
                  :class="
                    scopeFilter === opt.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click="scopeFilter = opt.key"
                >
                  {{ opt.label }}
                  <span class="text-muted-foreground text-xs tabular-nums">{{ opt.count }}</span>
                </button>
              </div>
              <p class="text-muted-foreground text-sm tabular-nums">
                {{ filteredTasks.length }} tasks · {{ filteredPoints }} pts
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="board" class="gap-1.5">
                <LayoutGrid class="size-3.5" /> Board
              </TabsTrigger>
              <TabsTrigger value="flow" class="gap-1.5">
                <Workflow class="size-3.5" /> Flow
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="board">
            <TasksBoard :tasks="filteredTasks" :statuses="tasks!.statuses" />
          </TabsContent>
          <TabsContent value="flow">
            <TasksFlow :tasks="filteredTasks" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  </section>
</template>
