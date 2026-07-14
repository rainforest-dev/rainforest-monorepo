<script setup lang="ts">
import { Minus, Plus, RotateCcw } from '@lucide/vue';
import { computed, ref } from 'vue';

import type { SprintTask } from '@/lib/tasks';
import { statusColor, statusSoftBg } from '@/lib/taskStatus';

const props = defineProps<{ tasks: SprintTask[] }>();
// A task node opens the in-app detail drawer (epics/stories are structural).
const emit = defineEmits<{ select: [task: SprintTask] }>();

// ── Layout constants ────────────────────────────────────────────────────────
const EPIC_X = 16;
const STORY_X = 232;
const TASK_X = 448;
const COL_W = 190;
const TASK_W = 214;
const ROW_H = 80;
const TOP = 24;
const TASK_H = 62;
const NODE_H = 46;

interface GNode {
  key: string;
  type: 'epic' | 'story' | 'task';
  x: number;
  y: number;
  w: number;
  h: number;
  cy: number;
  idLabel: string;
  label: string;
  status?: string;
  task?: SprintTask;
  ungrouped?: boolean;
}
interface GEdge {
  key: string;
  d: string;
}

// ── Hierarchy (mirrors the Epic → Story → Task grouping) ─────────────────────
interface StoryGroup {
  key: string;
  id: string;
  name: string;
  tasks: SprintTask[];
}
interface EpicLane {
  key: string;
  id: string;
  name: string;
  ungrouped: boolean;
  stories: StoryGroup[];
  directTasks: SprintTask[];
}

function buildLanes(tasks: SprintTask[]): EpicLane[] {
  const map = new Map<string, EpicLane>();
  const ordered = tasks.slice().sort((a, b) => a.order - b.order);

  const laneFor = (t: SprintTask): EpicLane => {
    const key = t.epic ? `epic:${t.epic.id ?? t.epic.name}` : 'ungrouped';
    let lane = map.get(key);
    if (!lane) {
      lane = {
        key,
        id: t.epic ? String(t.epic.id ?? '') : '',
        name: t.epic?.name ?? 'Ungrouped',
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
      const sk = `story:${t.parent.id ?? t.parent.name}`;
      let story = lane.stories.find((s) => s.key === sk);
      if (!story) {
        story = { key: sk, id: String(t.parent.id ?? ''), name: t.parent.name, tasks: [] };
        lane.stories.push(story);
      }
      story.tasks.push(t);
    } else {
      lane.directTasks.push(t);
    }
  }
  return [...map.values()].sort((a, b) => Number(a.ungrouped) - Number(b.ungrouped));
}

function shortName(name: string): string {
  // Trim a leading "[Bracket] " tag so the node label leads with the substance.
  return name.replace(/^\[[^\]]*\]\s*/, '');
}

// ── Build nodes + edges with a simple layered layout ─────────────────────────
const graph = computed<{ nodes: GNode[]; edges: GEdge[]; w: number; h: number }>(() => {
  const lanes = buildLanes(props.tasks);
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  let row = 0;

  const taskNode = (t: SprintTask): GNode => {
    const y = TOP + row * ROW_H;
    row += 1;
    const n: GNode = {
      key: `t:${t.id ?? t.name}`,
      type: 'task',
      x: TASK_X,
      y,
      w: TASK_W,
      h: TASK_H,
      cy: y + TASK_H / 2,
      idLabel: `#${t.id ?? '—'}`,
      label: shortName(t.name),
      status: t.status,
      task: t,
    };
    nodes.push(n);
    return n;
  };

  for (const lane of lanes) {
    const childCenters: number[] = [];
    const epicKey = `e:${lane.key}`;

    for (const story of lane.stories) {
      const taskNodes = story.tasks.map(taskNode);
      const storyCy = taskNodes.reduce((s, n) => s + n.cy, 0) / (taskNodes.length || 1);
      const storyNode: GNode = {
        key: `s:${story.key}`,
        type: 'story',
        x: STORY_X,
        y: storyCy - NODE_H / 2,
        w: COL_W,
        h: NODE_H,
        cy: storyCy,
        idLabel: story.id ? `#${story.id}` : 'story',
        label: shortName(story.name),
      };
      nodes.push(storyNode);
      for (const tn of taskNodes) {
        edges.push({ key: `${storyNode.key}->${tn.key}`, d: edge(storyNode, tn) });
      }
      childCenters.push(storyCy);
    }

    for (const t of lane.directTasks) {
      const tn = taskNode(t);
      childCenters.push(tn.cy);
      // Task → Epic directly (no parent story); path filled once the epic
      // node's position is known below.
      edges.push({ key: `${epicKey}->${tn.key}`, d: '' });
    }

    // Empty lane still occupies a row so it stays visible.
    if (childCenters.length === 0) {
      childCenters.push(TOP + row * ROW_H + NODE_H / 2);
      row += 1;
    }

    const epicCy = childCenters.reduce((s, c) => s + c, 0) / childCenters.length;
    const epicNode: GNode = {
      key: epicKey,
      type: 'epic',
      x: EPIC_X,
      y: epicCy - NODE_H / 2,
      w: COL_W,
      h: NODE_H,
      cy: epicCy,
      idLabel: lane.ungrouped ? '' : lane.id ? `#${lane.id}` : '',
      label: lane.name,
      ungrouped: lane.ungrouped,
    };
    nodes.push(epicNode);

    // Wire epic → each story, and epic → each direct task.
    for (const story of lane.stories) {
      const sNode = nodes.find((n) => n.key === `s:${story.key}`)!;
      edges.push({ key: `${epicNode.key}->${sNode.key}`, d: edge(epicNode, sNode) });
    }
    for (const t of lane.directTasks) {
      const tNode = nodes.find((n) => n.key === `t:${t.id ?? t.name}`)!;
      const e = edges.find((x) => x.key === `${epicKey}->${tNode.key}`);
      if (e) e.d = edge(epicNode, tNode);
    }
  }

  const w = TASK_X + TASK_W + EPIC_X;
  const h = TOP + Math.max(row, 1) * ROW_H;
  return { nodes, edges, w, h };
});

/** Cubic-bezier path from a parent's right edge to a child's left edge. */
function edge(a: GNode, b: GNode): string {
  const x1 = a.x + a.w;
  const y1 = a.cy;
  const x2 = b.x;
  const y2 = b.cy;
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

// ── Zoom (pan is native scroll of the container) ─────────────────────────────
const k = ref(1);
const clampK = (v: number) => Math.min(1.8, Math.max(0.5, v));
const zoomIn = () => (k.value = clampK(k.value + 0.15));
const zoomOut = () => (k.value = clampK(k.value - 0.15));
const reset = () => (k.value = 1);

// Drag-to-pan the scroll container (skips node buttons via pointer target).
const scroller = ref<HTMLElement | null>(null);
let dragging = false;
let sx = 0;
let sy = 0;
let sl = 0;
let st = 0;
function onDown(e: PointerEvent) {
  const el = scroller.value;
  if (!el || (e.target as HTMLElement).closest('[data-node="task"]')) return;
  dragging = true;
  sx = e.clientX;
  sy = e.clientY;
  sl = el.scrollLeft;
  st = el.scrollTop;
  el.setPointerCapture(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (!dragging || !scroller.value) return;
  scroller.value.scrollLeft = sl - (e.clientX - sx);
  scroller.value.scrollTop = st - (e.clientY - sy);
}
function onUp() {
  dragging = false;
}

function nodeStyle(n: GNode): Record<string, string> {
  if (n.type === 'task') {
    return {
      borderLeft: `4px solid ${statusColor(n.status ?? '')}`,
      backgroundColor: statusSoftBg(n.status ?? ''),
    };
  }
  if (n.type === 'epic') {
    return n.ungrouped
      ? { border: '1px dashed var(--border)', backgroundColor: 'var(--muted)' }
      : { border: '1px solid var(--border)', backgroundColor: 'var(--accent)' };
  }
  return { border: '1px solid var(--border)', backgroundColor: 'var(--card)' };
}

const typeBadge = (t: GNode['type']) => (t === 'epic' ? 'E' : t === 'story' ? 'S' : 'T');
</script>

<template>
  <div class="border-border relative overflow-hidden rounded-lg border">
    <!-- Zoom controls -->
    <div class="absolute right-2 top-2 z-10 flex gap-1">
      <button
        type="button"
        class="bg-card border-border text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md border shadow-sm"
        aria-label="Zoom out"
        @click="zoomOut"
      >
        <Minus class="size-3.5" />
      </button>
      <button
        type="button"
        class="bg-card border-border text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md border shadow-sm"
        aria-label="Reset zoom"
        @click="reset"
      >
        <RotateCcw class="size-3.5" />
      </button>
      <button
        type="button"
        class="bg-card border-border text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md border shadow-sm"
        aria-label="Zoom in"
        @click="zoomIn"
      >
        <Plus class="size-3.5" />
      </button>
    </div>

    <!-- Legend -->
    <div
      class="text-muted-foreground absolute bottom-2 left-2 z-10 flex flex-wrap gap-x-3 gap-y-1 text-[10px]"
    >
      <span><b class="text-foreground">E</b> epic</span>
      <span><b class="text-foreground">S</b> story</span>
      <span><b class="text-foreground">T</b> task · click to open</span>
    </div>

    <div
      ref="scroller"
      class="bg-muted/10 max-h-[560px] cursor-grab overflow-auto active:cursor-grabbing"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <svg
        :width="graph.w * k"
        :height="graph.h * k"
        :viewBox="`0 0 ${graph.w} ${graph.h}`"
        class="block"
      >
        <!-- Edges under nodes -->
        <path
          v-for="e in graph.edges"
          :key="e.key"
          :d="e.d"
          fill="none"
          stroke="var(--border)"
          stroke-width="1.5"
        />

        <!-- Nodes -->
        <foreignObject
          v-for="n in graph.nodes"
          :key="n.key"
          :x="n.x"
          :y="n.y"
          :width="n.w"
          :height="n.h"
        >
          <component
            :is="n.type === 'task' ? 'button' : 'div'"
            :data-node="n.type"
            :type="n.type === 'task' ? 'button' : undefined"
            class="flex h-full w-full flex-col justify-center gap-0.5 overflow-hidden rounded-md px-2 py-1 text-left"
            :class="
              n.type === 'task'
                ? 'hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                : ''
            "
            :style="nodeStyle(n)"
            @click="n.task && emit('select', n.task)"
          >
            <div class="flex items-center gap-1.5">
              <span
                class="text-muted-foreground bg-background/70 inline-flex size-4 shrink-0 items-center justify-center rounded text-[9px] font-bold"
              >
                {{ typeBadge(n.type) }}
              </span>
              <span
                v-if="n.idLabel"
                class="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums"
              >
                {{ n.idLabel }}
              </span>
              <span
                v-if="n.type === 'task' && n.task?.hasFeedback"
                class="inline-block size-1.5 shrink-0 rounded-full"
                :style="{ backgroundColor: 'var(--status-warning)' }"
                title="Feedback awaiting tuning"
                aria-label="Feedback awaiting tuning"
              />
              <span
                v-if="n.type === 'task' && n.task?.points != null"
                class="text-foreground bg-background/70 ml-auto shrink-0 rounded px-1 text-[10px] font-semibold tabular-nums"
              >
                {{ n.task.points }}p
              </span>
            </div>
            <span
              class="text-foreground truncate text-[11px] font-medium leading-tight"
              :class="n.type === 'task' ? 'line-clamp-2 whitespace-normal' : 'truncate'"
              :title="n.label"
            >
              {{ n.label }}
            </span>
          </component>
        </foreignObject>
      </svg>
    </div>
  </div>
</template>
