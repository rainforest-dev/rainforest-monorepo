<script setup lang="ts">
import { RefreshCw } from '@lucide/vue';
import { useNow } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import SprintHeading from '@/components/SprintHeading.vue';
import TaskDetail from '@/components/TaskDetail.vue';
import TaskFilterBar, {
  type ScopeFilter,
  type ScopeOption,
  type TaskView,
} from '@/components/TaskFilterBar.vue';
import TasksBoard from '@/components/TasksBoard.vue';
import TasksGraph from '@/components/TasksGraph.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DEFAULT_SORT_MODE, type SortMode } from '@/lib/taskSort';
import type { SprintTask, TasksData } from '@/lib/tasks';
import { trackerNotice } from '@/lib/tasksHeader';

// Self-fetching page island (mounted directly on /tasks).
const data = ref<TasksData | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

/**
 * How often the board re-reads the API.
 *
 * The panel used to fetch once on mount and then only on the Refresh button, so
 * a `loopctl set` landing while the page was open never appeared -- and until
 * 2026-09-03 that button returned 403 from the public address, which left no
 * working path to a current board at all.
 *
 * Cheap enough to do on a timer: /api/tasks reads local files, and the overlay
 * it merges (`tasks-progress.json`) is written by every `loopctl set`, so the
 * loop's own progress shows up without anything being rebuilt.
 */
const POLL_MS = 30_000;

/**
 * `background` skips the spinner. A poll that flips the panel into its loading
 * state every thirty seconds would make a board nobody touched look busy, and
 * would throw away the scroll position on a long list.
 */
async function load(background = false) {
  if (!background) loading.value = true;
  error.value = null;
  try {
    const res = await fetch('/api/tasks');
    if (!res.ok) throw new Error(`/api/tasks HTTP ${res.status}`);
    const d = (await res.json()) as TasksData | { error: string } | null;
    data.value = d && 'error' in d ? null : d;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

let poll: ReturnType<typeof setInterval> | null = null;

/**
 * Only while the tab is visible.
 *
 * A backgrounded tab left open overnight would otherwise keep asking, and the
 * answer it stored would be from whenever the machine last let the timer run --
 * so it also reloads immediately on becoming visible again, rather than showing
 * a stale board until the next tick.
 */
function onVisibility() {
  if (document.visibilityState === 'visible') {
    void load(true);
    poll ??= setInterval(() => void load(true), POLL_MS);
  } else if (poll) {
    clearInterval(poll);
    poll = null;
  }
}

const onRefreshEvent = () => void load();

onMounted(() => {
  void load();
  window.addEventListener('lo:refresh', onRefreshEvent);
  document.addEventListener('visibilitychange', onVisibility);
  if (document.visibilityState === 'visible')
    poll = setInterval(() => void load(true), POLL_MS);
});
onBeforeUnmount(() => {
  window.removeEventListener('lo:refresh', onRefreshEvent);
  document.removeEventListener('visibilitychange', onVisibility);
  if (poll) clearInterval(poll);
});

// The pill's ages re-render on this tick.
const now = useNow({ interval: 30_000 });
const hasTasks = computed(() => (data.value?.tasks.length ?? 0) > 0);

const notice = computed(() =>
  trackerNotice(data.value?.synced_at, data.value?.written_at, now.value),
);

// Scope filter shared by both the Board and the Graph views.
const scopeFilter = ref<ScopeFilter>('all');
const allTasks = computed<SprintTask[]>(() => data.value?.tasks ?? []);

// Which view is showing, and how the Board orders cards inside a column.
const activeView = ref<TaskView>('board');
const sortMode = ref<SortMode>(DEFAULT_SORT_MODE);

const scopeOptions = computed<ScopeOption[]>(() => [
  { key: 'all', label: 'All', count: allTasks.value.length },
  {
    key: 'work',
    label: 'Work',
    count: allTasks.value.filter((t) => t.scope === 'work').length,
  },
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

// Detail drawer: clicking a card/node opens the local note in-app.
const selected = ref<SprintTask | null>(null);
const drawerOpen = ref(false);
function openTask(task: SprintTask) {
  selected.value = task;
  drawerOpen.value = true;
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <SprintHeading :sprint-name="data?.sprint?.name ?? null" :notice="notice" />

    <div v-if="loading" class="text-muted-foreground py-24 text-center">
      Loading sprint tasks…
    </div>

    <div v-else-if="error" class="py-16 text-center">
      <p class="text-destructive font-medium">Failed to load tasks.</p>
      <p class="text-muted-foreground mt-1 text-sm">{{ error }}</p>
      <Button class="mt-4" variant="outline" @click="load">
        <RefreshCw class="size-4" /> Retry
      </Button>
    </div>

    <Card v-else>
      <CardContent class="p-4 sm:p-6">
        <div
          v-if="!hasTasks"
          class="text-muted-foreground flex items-center justify-center rounded-md border border-dashed px-4 py-10 text-sm"
        >
          No sprint tasks yet — populate
          <code class="text-foreground mx-1">_system/usage/tasks.json</code>
          from the Notion board.
        </div>

        <template v-else>
          <TaskFilterBar
            v-model:scope="scopeFilter"
            v-model:sort-mode="sortMode"
            v-model:view="activeView"
            class="mb-4"
            :scope-options="scopeOptions"
            :task-count="filteredTasks.length"
            :points-total="filteredPoints"
          />

          <TasksBoard
            v-if="activeView === 'board'"
            :tasks="filteredTasks"
            :statuses="data!.statuses"
            :sort-mode="sortMode"
            @select="openTask"
          />
          <TasksGraph
            v-else
            :tasks="filteredTasks"
            :statuses="data!.statuses"
            @select="openTask"
          />
        </template>
      </CardContent>
    </Card>

    <TaskDetail
      :task="selected"
      :open="drawerOpen"
      :statuses="data?.statuses ?? []"
      @close="drawerOpen = false"
    />
  </section>
</template>
