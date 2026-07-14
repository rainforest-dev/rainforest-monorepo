<script setup lang="ts">
import { ExternalLink, GitBranch, Layers } from '@lucide/vue';
import { computed } from 'vue';

import type { SprintTask } from '@/lib/tasks';
import { scopeBadge, statusColor, statusSoftBg } from '@/lib/taskStatus';

const props = defineProps<{ tasks: SprintTask[] }>();

interface StoryNode {
  key: string;
  name: string;
  url: string | null;
  tasks: SprintTask[];
}
interface EpicLane {
  key: string;
  name: string;
  url: string | null;
  ungrouped: boolean;
  stories: StoryNode[];
  directTasks: SprintTask[];
}

// Build the Epic → Story(parent) → Task hierarchy:
//   • a task with a parent nests under that parent story;
//   • a task without a parent sits directly under its epic;
//   • a task with neither goes in the "Ungrouped" lane.
// Lanes/stories keep first-seen order (tasks are pre-sorted by `order`).
const lanes = computed<EpicLane[]>(() => {
  const map = new Map<string, EpicLane>();
  const ordered = props.tasks.slice().sort((a, b) => a.order - b.order);

  const laneFor = (t: SprintTask): EpicLane => {
    const key = t.epic ? `epic:${t.epic.id ?? t.epic.name}` : 'ungrouped';
    let lane = map.get(key);
    if (!lane) {
      lane = {
        key,
        name: t.epic?.name ?? 'Ungrouped',
        url: t.epic?.url ?? null,
        ungrouped: !t.epic,
        stories: [],
        directTasks: [],
      };
      map.set(key, lane);
    }
    return lane;
  };

  for (const t of ordered) {
    const lane = laneFor(t);
    if (t.parent) {
      const storyKey = `story:${t.parent.id ?? t.parent.name}`;
      let story = lane.stories.find((s) => s.key === storyKey);
      if (!story) {
        story = { key: storyKey, name: t.parent.name, url: t.parent.url, tasks: [] };
        lane.stories.push(story);
      }
      story.tasks.push(t);
    } else {
      lane.directTasks.push(t);
    }
  }

  // Real epics first, the Ungrouped catch-all last.
  return [...map.values()].sort(
    (a, b) => Number(a.ungrouped) - Number(b.ungrouped),
  );
});

const laneCount = (lane: EpicLane): number =>
  lane.directTasks.length + lane.stories.reduce((n, s) => n + s.tasks.length, 0);
</script>

<template>
  <div class="space-y-5">
    <section
      v-for="lane in lanes"
      :key="lane.key"
      class="border-border bg-muted/20 rounded-lg border p-4"
    >
      <!-- Epic lane header -->
      <div class="mb-3 flex items-center gap-2">
        <Layers class="text-muted-foreground size-4 shrink-0" />
        <h3
          class="text-foreground truncate text-sm font-semibold"
          :class="lane.ungrouped ? 'text-muted-foreground italic' : ''"
        >
          {{ lane.name }}
        </h3>
        <a
          v-if="lane.url"
          :href="lane.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-muted-foreground hover:text-foreground shrink-0"
        >
          <ExternalLink class="size-3" />
        </a>
        <span class="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
          {{ laneCount(lane) }} tasks
        </span>
      </div>

      <div class="space-y-3 pl-1.5">
        <!-- Parent stories, each with their nested tasks -->
        <div
          v-for="story in lane.stories"
          :key="story.key"
          class="border-border border-l-2 pl-3"
        >
          <div class="mb-1.5 flex items-center gap-1.5">
            <GitBranch class="text-muted-foreground size-3.5 shrink-0" />
            <span class="text-foreground truncate text-xs font-medium" :title="story.name">
              {{ story.name }}
            </span>
            <a
              v-if="story.url"
              :href="story.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-muted-foreground hover:text-foreground shrink-0"
            >
              <ExternalLink class="size-3" />
            </a>
          </div>
          <div class="flex flex-wrap gap-2 pl-5">
            <a
              v-for="t in story.tasks"
              :key="t.id ?? t.name"
              :href="t.task_ref ?? undefined"
              :target="t.task_ref ? '_blank' : undefined"
              rel="noopener noreferrer"
              class="border-border hover:border-foreground/30 block max-w-[16rem] rounded-md border border-l-4 px-2.5 py-1.5 shadow-sm transition-colors"
              :style="{
                borderLeftColor: statusColor(t.status),
                backgroundColor: statusSoftBg(t.status),
              }"
            >
              <div class="flex items-center gap-1.5">
                <span class="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
                  #{{ t.id ?? '—' }}
                </span>
                <span
                  class="shrink-0 rounded px-1 text-[10px] font-medium"
                  :style="{
                    color: scopeBadge(t.scope).color,
                    backgroundColor: scopeBadge(t.scope).bg,
                  }"
                >
                  {{ scopeBadge(t.scope).label }}
                </span>
                <span
                  v-if="t.points != null"
                  class="text-foreground bg-background/60 ml-auto shrink-0 rounded px-1 text-[10px] font-semibold tabular-nums"
                >
                  {{ t.points }}p
                </span>
              </div>
              <p class="text-foreground line-clamp-2 text-xs leading-snug">{{ t.name }}</p>
              <p class="text-muted-foreground mt-0.5 text-[10px]">{{ t.status }}</p>
            </a>
          </div>
        </div>

        <!-- Tasks sitting directly under the epic (no parent story) -->
        <div v-if="lane.directTasks.length" class="flex flex-wrap gap-2 pl-3">
          <a
            v-for="t in lane.directTasks"
            :key="t.id ?? t.name"
            :href="t.task_ref ?? undefined"
            :target="t.task_ref ? '_blank' : undefined"
            rel="noopener noreferrer"
            class="border-border hover:border-foreground/30 block max-w-[16rem] rounded-md border border-l-4 px-2.5 py-1.5 shadow-sm transition-colors"
            :style="{
              borderLeftColor: statusColor(t.status),
              backgroundColor: statusSoftBg(t.status),
            }"
          >
            <div class="flex items-center gap-1.5">
              <span class="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
                #{{ t.id ?? '—' }}
              </span>
              <span
                class="shrink-0 rounded px-1 text-[10px] font-medium"
                :style="{
                  color: scopeBadge(t.scope).color,
                  backgroundColor: scopeBadge(t.scope).bg,
                }"
              >
                {{ scopeBadge(t.scope).label }}
              </span>
              <span
                v-if="t.points != null"
                class="text-foreground bg-background/60 ml-auto shrink-0 rounded px-1 text-[10px] font-semibold tabular-nums"
              >
                {{ t.points }}p
              </span>
            </div>
            <p class="text-foreground line-clamp-2 text-xs leading-snug">{{ t.name }}</p>
            <p class="text-muted-foreground mt-0.5 text-[10px]">{{ t.status }}</p>
          </a>
        </div>
      </div>
    </section>
  </div>
</template>
