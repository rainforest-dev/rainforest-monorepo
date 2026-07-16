<script setup lang="ts">
import { Bot, Check, Circle, ExternalLink, Hand, Minus, Plus, RotateCcw } from '@lucide/vue';
import {
  useDocumentVisibility,
  useIntersectionObserver,
  useMediaQuery,
  useRafFn,
} from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

// Type-only: keep the client bundle free of tasks.ts's node:fs/node:path deps
// (mirrors TaskDetail/TasksBoard's type-only import of tasks.ts).
import type { SprintTask } from '@/lib/tasks';
import {
  boardColumn,
  boardColumnColor,
  loopStageLabel,
  ownerMeta,
  scopeBadge,
  taskOwner,
  type Owner,
} from '@/lib/taskStatus';

const props = defineProps<{ tasks: SprintTask[]; statuses: string[] }>();
// A task token (chip) or the live loop core opens the in-app detail drawer.
// Contract unchanged: TasksPanel.vue forwards :tasks :statuses @select as before.
const emit = defineEmits<{ select: [task: SprintTask] }>();

const OWNER_ICON = { ai: Bot, you: Hand, done: Check, parked: Circle } as const;

// ── Hand-authored board geometry (NO auto-layout) ────────────────────────────
// One closed rounded-rect racetrack: Not started → In progress → In review →
// In QA → Done, then a copper return trace back to Not started. Blocked lives
// OFF the ring as a grounded side-spur below In progress. Loop core in center.
const BOARD_W = 920;
const BOARD_H = 640;
const CAP = 5; // max chips shown per station before a +N overflow token

interface Rail {
  x: number;
  y: number;
  dx: number;
  dy: number;
}
interface Station {
  key: string;
  label: string;
  cx: number;
  cy: number;
  labelX: number;
  labelY: number;
  rail: Rail;
}

// Ring stations, in pipeline order. `rail` seats chips along the station's
// in-trace, stepping (dx,dy) per slot; directions chosen to clear the core + peers.
const STATIONS: Station[] = [
  { key: 'notstarted', label: 'Not started', cx: 200, cy: 165, labelX: 200, labelY: 132, rail: { x: 200, y: 272, dx: 0, dy: 60 } },
  { key: 'inprogress', label: 'In progress', cx: 690, cy: 165, labelX: 690, labelY: 132, rail: { x: 560, y: 165, dx: -150, dy: 0 } },
  { key: 'inreview', label: 'In review', cx: 800, cy: 365, labelX: 800, labelY: 398, rail: { x: 850, y: 276, dx: 0, dy: 44 } },
  { key: 'inqa', label: 'In QA', cx: 600, cy: 545, labelX: 600, labelY: 578, rail: { x: 600, y: 588, dx: 0, dy: 54 } },
  { key: 'done', label: 'Done', cx: 200, cy: 545, labelX: 200, labelY: 578, rail: { x: 300, y: 545, dx: 120, dy: 0 } },
];
// Blocked side-station (off the ring, grounded).
const BLOCKED: Station = {
  key: 'blocked',
  label: 'Blocked',
  cx: 690,
  cy: 430,
  labelX: 690,
  labelY: 452,
  rail: { x: 678, y: 246, dx: 0, dy: 44 },
};
const ALL_STATIONS = [...STATIONS, BLOCKED];
const RAIL_OF: Record<string, Rail> = Object.fromEntries(ALL_STATIONS.map((s) => [s.key, s.rail]));
const STATION_LABEL: Record<string, string> = Object.fromEntries(
  ALL_STATIONS.map((s) => [s.key, s.label]),
);
// Station accent color: reuses the board's per-column color (Blocked stays red,
// every other station takes its owner's hue) so a +N token never mis-signals red.
function stationColor(key: string): string {
  return boardColumnColor(STATION_LABEL[key] ?? '');
}

// Board column → station. Backlog folds into Not started; Released/Closed into Done.
const COLUMN_STATION: Record<string, string> = {
  Backlog: 'notstarted',
  'Not started': 'notstarted',
  'In progress': 'inprogress',
  'In review': 'inreview',
  'In QA': 'inqa',
  Done: 'done',
  Released: 'done',
  Closed: 'done',
  Blocked: 'blocked',
};
function stationOf(t: SprintTask): string {
  return COLUMN_STATION[boardColumn(t.status, t.loopStatus)] ?? 'notstarted';
}
function stationLabelOf(t: SprintTask): string {
  return STATION_LABEL[stationOf(t)] ?? '';
}
// Chip footprint scales with points (spec: default when null/fractional).
// null / non-integer → base; 1–2 small, 3–5 medium, 8+ large. Feeds `--pts-w`.
function chipWidth(t: SprintTask): string {
  const p = t.points;
  if (p == null || !Number.isInteger(p)) return '104px';
  if (p <= 2) return '104px';
  if (p <= 5) return '128px';
  return '156px';
}

// ── Per-task derivations ─────────────────────────────────────────────────────
function ownerOf(t: SprintTask): Owner {
  return taskOwner(t.status, t.loopStatus);
}
function isDraft(t: SprintTask): boolean {
  return t.loopStatus === 'Spec drafted' || t.loopStatus === 'Split drafted';
}
function isPrReady(t: SprintTask): boolean {
  return t.loopStatus === 'PR ready';
}
function chipId(t: SprintTask): string {
  return String(t.id ?? t.name);
}
function shortName(name: string): string {
  // Trim a leading "[Bracket] " tag so the token leads with the substance.
  return name.replace(/^\[[^\]]*\]\s*/, '');
}
function epicKey(t: SprintTask): string {
  return t.epic ? String(t.epic.id ?? t.epic.name) : '';
}

// Deterministic epic → chart-token color (the solder-dot hue), cycling chart-1..5.
const EPIC_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
const epicColors = computed(() => {
  const m = new Map<string, string>();
  let i = 0;
  for (const t of props.tasks) {
    const k = epicKey(t);
    if (k && !m.has(k)) m.set(k, EPIC_PALETTE[i++ % EPIC_PALETTE.length]);
  }
  return m;
});
function epicColor(t: SprintTask): string {
  return epicColors.value.get(epicKey(t)) ?? 'var(--chart-1)';
}

// ── Bin tasks into stations (real data, not the mockup placeholders) ─────────
const binned = computed<Record<string, SprintTask[]>>(() => {
  const by: Record<string, SprintTask[]> = {};
  for (const s of ALL_STATIONS) by[s.key] = [];
  for (const t of props.tasks) (by[stationOf(t)] ??= []).push(t);
  for (const k of Object.keys(by)) by[k].sort((a, b) => a.order - b.order);
  return by;
});
function stationCount(key: string): number {
  return binned.value[key]?.length ?? 0;
}
function stationTip(s: Station): string {
  const n = stationCount(s.key);
  return `${s.label} · ${n} ${n === 1 ? 'task' : 'tasks'}`;
}

// ── Chip placement (cap + expandable +N overflow) ────────────────────────────
const expanded = reactive<Record<string, boolean>>({});
function toggleOverflow(key: string) {
  expanded[key] = !expanded[key];
}
function railStyle(rail: Rail, i: number): Record<string, string> {
  return { left: `${rail.x + rail.dx * i}px`, top: `${rail.y + rail.dy * i}px` };
}

interface PlacedChip {
  id: string;
  task: SprintTask;
  style: Record<string, string>;
}
interface OverflowToken {
  key: string;
  label: string;
  style: Record<string, string>;
}
const placed = computed(() => {
  const chips: PlacedChip[] = [];
  const overflow: OverflowToken[] = [];
  for (const [key, list] of Object.entries(binned.value)) {
    const rail = RAIL_OF[key];
    if (!rail) continue;
    const isExp = expanded[key];
    const shown = isExp ? list : list.slice(0, CAP);
    shown.forEach((t, i) => chips.push({ id: chipId(t), task: t, style: railStyle(rail, i) }));
    const extra = list.length - CAP;
    if (extra > 0) {
      overflow.push({
        key,
        label: isExp ? 'less' : `+${extra} more`,
        style: railStyle(rail, isExp ? list.length : CAP),
      });
    }
  }
  return { chips, overflow };
});

// ── Live current: which traces flow, the loop core, the beat cadence ─────────
// t1 (→ In progress) flows blue when the AI is executing there; t2 (→ In review)
// flows a calmer amber when PRs are waiting on you.
const inProgressActive = computed(() => binned.value.inprogress?.some((t) => ownerOf(t) === 'ai'));
const inReviewActive = computed(() =>
  binned.value.inreview?.some((t) => isPrReady(t) || ownerOf(t) === 'you'),
);
const anyFlow = computed(() => inProgressActive.value || inReviewActive.value);

const aiActiveCount = computed(() => props.tasks.filter((t) => ownerOf(t) === 'ai').length);
const liveTask = computed<SprintTask | null>(() => {
  const ai = props.tasks.filter((t) => ownerOf(t) === 'ai');
  return ai.find((t) => stationOf(t) === 'inprogress') ?? ai[0] ?? null;
});
// Beat cadence: more AI tasks live → a faster pulse. Clamped to a calm range.
const beatStyle = computed(() => ({
  '--beat-duration': `${Math.max(0.8, 2.0 - (aiActiveCount.value - 1) * 0.2)}s`,
}));
const coreStageLabel = computed(() => {
  const t = liveTask.value;
  if (!t) return '';
  const stage = loopStageLabel(t.loopStatus, props.statuses) ?? t.loopStatus ?? 'executing';
  const n = aiActiveCount.value;
  return `Executing · ${stage} · ${n} AI ${n === 1 ? 'task' : 'tasks'} live`;
});

// ── Epic solder-dot hover grouping ───────────────────────────────────────────
const hoverEpic = ref<string | null>(null);
function chipHiClass(t: SprintTask): Record<string, boolean> {
  if (!hoverEpic.value) return {};
  const same = epicKey(t) === hoverEpic.value;
  return { hi: same, dim: !same };
}

// ── Pan / zoom shell (transform-based so HTML chips track the SVG) ────────────
const stageEl = ref<HTMLElement | null>(null);
const stageSize = reactive({ w: 0, h: 0 });
const view = reactive({ scale: 1, x: 0, y: 0 });
function measure() {
  const r = stageEl.value?.getBoundingClientRect();
  if (r) {
    stageSize.w = r.width;
    stageSize.h = r.height;
  }
}
const boardStyle = computed(() => {
  // Centre the *scaled* board (transform-origin is 0 0, so account for scale).
  const bx = (stageSize.w - BOARD_W * view.scale) / 2 + view.x;
  const by = (stageSize.h - BOARD_H * view.scale) / 2 + view.y;
  return { transform: `translate(${bx}px, ${by}px) scale(${view.scale})` };
});
const clampK = (v: number) => Math.min(2.2, Math.max(0.5, +v.toFixed(2)));
// Scale that fits the whole 920×640 board inside the stage (small margin).
function fitScale(): number {
  if (!stageSize.w || !stageSize.h) return 1;
  return clampK(Math.min(stageSize.w / BOARD_W, stageSize.h / BOARD_H) * 0.94);
}
const zoomIn = () => (view.scale = clampK(view.scale + 0.15));
const zoomOut = () => (view.scale = clampK(view.scale - 0.15));
const reset = () => {
  view.scale = fitScale();
  view.x = 0;
  view.y = 0;
};
function onWheel(e: WheelEvent) {
  e.preventDefault();
  view.scale = clampK(view.scale + (e.deltaY < 0 ? 0.08 : -0.08));
}

// Pointer-drag pan. Drags starting on a chip / core / toolbar are ignored so
// their clicks still register; `moved` suppresses a click after a real drag.
let dragging = false;
let sx = 0;
let sy = 0;
let ox = 0;
let oy = 0;
const moved = ref(false);
function onDown(e: PointerEvent) {
  const t = e.target as HTMLElement;
  if (t.closest('.chip') || t.closest('.core') || t.closest('.toolbar')) return;
  dragging = true;
  moved.value = false;
  sx = e.clientX;
  sy = e.clientY;
  ox = view.x;
  oy = view.y;
  stageEl.value?.setPointerCapture(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (!dragging) return;
  view.x = ox + (e.clientX - sx);
  view.y = oy + (e.clientY - sy);
  if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) moved.value = true;
}
function onUp(e: PointerEvent) {
  dragging = false;
  try {
    stageEl.value?.releasePointerCapture(e.pointerId);
  } catch {
    /* capture may already be released */
  }
  // Reset here so the guard never outlives the single gesture that set it —
  // otherwise a real pan leaves `moved` true and silently swallows every
  // subsequent chip/core click + keyboard activation.
  moved.value = false;
}

function selectTask(t: SprintTask | null) {
  if (t && !moved.value) emit('select', t);
}

// ── Animation gating (client-only mounted ref, mirrors TaskDetail.vue) ────────
// Pages hydrate eagerly, so the SVG geometry (getPointAtLength) and observers
// must only run once mounted. Off-screen / hidden-tab freezes via `.paused`.
const mounted = ref(false);
const onScreen = ref(false);
const visibility = useDocumentVisibility();
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
const paused = computed(
  () => !mounted.value || !onScreen.value || visibility.value === 'hidden',
);

useIntersectionObserver(
  stageEl,
  ([entry]) => {
    onScreen.value = entry?.isIntersecting ?? false;
  },
  { threshold: 0.05 },
);

// ── Optional glow-packet driven along the live traces (useRafFn) ─────────────
const pathAiEl = ref<SVGPathElement | null>(null);
const pathYouEl = ref<SVGPathElement | null>(null);
const packetAiEl = ref<SVGCircleElement | null>(null);
const packetYouEl = ref<SVGCircleElement | null>(null);
const PACKET_MS = 3200;
let elapsed = 0;
// The trace `d` attributes are static, so total length never changes — cache it
// once per path instead of recomputing (a layout-forcing call) every rAF tick.
const pathLenCache = new WeakMap<SVGPathElement, number>();
function movePacket(path: SVGPathElement | null, packet: SVGCircleElement | null, f: number) {
  if (!path || !packet) return;
  let len = pathLenCache.get(path);
  if (len === undefined) {
    len = path.getTotalLength();
    pathLenCache.set(path, len);
  }
  const p = path.getPointAtLength(f * len);
  packet.setAttribute('cx', String(p.x));
  packet.setAttribute('cy', String(p.y));
}
const { pause: pauseRaf, resume: resumeRaf } = useRafFn(
  ({ delta }) => {
    elapsed += delta;
    const f = (elapsed % PACKET_MS) / PACKET_MS;
    if (inProgressActive.value) movePacket(pathAiEl.value, packetAiEl.value, f);
    if (inReviewActive.value) movePacket(pathYouEl.value, packetYouEl.value, f);
  },
  { immediate: false },
);
// Run the packet loop only when active, visible, and motion is allowed.
const packetsOn = computed(
  () => mounted.value && !paused.value && !reduced.value && !!anyFlow.value,
);
function syncPackets() {
  if (packetsOn.value) resumeRaf();
  else pauseRaf();
}
watch(packetsOn, syncPackets);

onMounted(() => {
  mounted.value = true;
  measure();
  view.scale = fitScale();
  window.addEventListener('resize', measure);
  syncPackets();
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure);
  pauseRaf();
});
</script>

<template>
  <div class="border-border relative overflow-hidden rounded-lg border">
    <!-- Legend (color is never the sole signal — icons + textures back it) -->
    <div class="legend" role="group" aria-label="Graph legend">
      <span class="item"><Bot class="ico" :style="{ color: ownerMeta('ai').color }" />AI</span>
      <span class="item"><Hand class="ico" :style="{ color: ownerMeta('you').color }" />You</span>
      <span class="item"><Check class="ico" :style="{ color: ownerMeta('done').color }" />Done</span>
      <span class="item"><Circle class="ico" :style="{ color: ownerMeta('parked').color }" />Parked</span>
      <span class="sep" />
      <span class="item"><span class="flowkey" />AI current (live)</span>
      <span class="item"><span class="flowkey you" />Your turn (PR ready)</span>
      <span class="item"><span class="dashkey" />Draft · your call</span>
      <span class="item"><span class="blockkey" />Blocked</span>
    </div>

    <!-- Screen-reader pipeline summary (the SVG board is aria-hidden). -->
    <ul class="sr-only" aria-label="Pipeline station counts">
      <li v-for="s in ALL_STATIONS" :key="`sr-${s.key}`">
        {{ s.label }}: {{ stationCount(s.key) }} {{ stationCount(s.key) === 1 ? 'task' : 'tasks' }}
      </li>
    </ul>

    <!-- Pan / zoom shell -->
    <div
      ref="stageEl"
      class="stage"
      :class="{ paused }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @wheel="onWheel"
    >
      <div class="board" :style="boardStyle">
        <!-- ── SVG: traces + stations ── -->
        <svg :viewBox="`0 0 ${BOARD_W} ${BOARD_H}`" aria-hidden="true">
          <!-- Return trace (Done → Not started): copper + one slow lone pulse -->
          <path class="trace-return" d="M 200 513 L 200 197" />
          <path class="trace-return-pulse" :class="{ flowing: anyFlow }" d="M 200 513 L 200 197" />

          <!-- In QA → Done : static copper -->
          <path class="trace-base" d="M 568 545 L 232 545" />
          <!-- In review → In QA : static copper -->
          <path class="trace-base" d="M 792 388 Q 730 528 632 545" />

          <!-- Not started → In progress : AI current (blue), flows when AI is live -->
          <path ref="pathAiEl" class="trace-base" d="M 232 165 L 658 165" />
          <path
            class="trace-overlay ai"
            :class="{ flowing: inProgressActive }"
            :style="{ opacity: inProgressActive ? 1 : 0 }"
            d="M 232 165 L 658 165"
          />

          <!-- In progress → In review : your-turn (amber), flows when PRs wait on you -->
          <path ref="pathYouEl" class="trace-base" d="M 704 190 Q 820 250 800 323" />
          <path
            class="trace-overlay you"
            :class="{ flowing: inReviewActive }"
            :style="{ opacity: inReviewActive ? 1 : 0 }"
            d="M 704 190 Q 820 250 800 323"
          />

          <!-- Blocked spur (off In progress, grounded, static dashed) -->
          <path class="spur" d="M 690 197 L 690 398" />
          <line class="spur-ground" x1="668" y1="402" x2="712" y2="402" />
          <line class="spur-ground" x1="675" y1="409" x2="705" y2="409" />
          <line class="spur-ground" x1="681" y1="416" x2="699" y2="416" />

          <!-- Moving glow packets on the live traces -->
          <circle v-if="inProgressActive && !reduced" ref="packetAiEl" class="packet ai" r="4.5" />
          <circle v-if="inReviewActive && !reduced" ref="packetYouEl" class="packet you" r="4.5" />

          <!-- Ring stations -->
          <g
            v-for="s in STATIONS"
            :key="s.key"
            class="station"
            :class="{ glow: (s.key === 'inprogress' && inProgressActive) || (s.key === 'inreview' && inReviewActive) }"
          >
            <title>{{ stationTip(s) }}</title>
            <circle class="ring" :cx="s.cx" :cy="s.cy" r="20" />
            <circle class="pad" :cx="s.cx" :cy="s.cy" r="12" />
            <text :x="s.labelX" :y="s.labelY" text-anchor="middle">
              {{ s.label }} <tspan class="count">·{{ stationCount(s.key) }}</tspan>
            </text>
          </g>

          <!-- Blocked side-station -->
          <g class="station blocked">
            <title>{{ stationTip(BLOCKED) }}</title>
            <circle class="pad" :cx="BLOCKED.cx" :cy="BLOCKED.cy" r="12" />
            <text :x="BLOCKED.labelX" :y="BLOCKED.labelY" text-anchor="middle">
              Blocked ·{{ stationCount('blocked') }}
            </text>
          </g>
        </svg>

        <!-- ── Loop core ── -->
        <div class="corewrap">
          <div
            class="core"
            :class="{ idle: aiActiveCount === 0 }"
            :title="aiActiveCount > 0 ? coreStageLabel : 'Loop at rest'"
            :style="beatStyle"
            role="button"
            :tabindex="aiActiveCount > 0 ? 0 : -1"
            :aria-label="liveTask ? `Live iteration: ${shortName(liveTask.name)}` : 'Loop at rest'"
            @click="selectTask(liveTask)"
            @keydown.enter.prevent="selectTask(liveTask)"
            @keydown.space.prevent="selectTask(liveTask)"
          >
            <template v-if="aiActiveCount > 0 && liveTask">
              <div class="k"><span class="beatdot" />Loop core · live</div>
              <div class="iter">{{ shortName(liveTask.name) }}</div>
              <div class="meta">
                <span
                  class="ownerchip"
                  :style="{ borderColor: ownerMeta('ai').color, color: ownerMeta('ai').color }"
                >
                  <Bot class="ico" />AI
                </span>
                <span v-if="liveTask.points != null" class="pts">{{ liveTask.points }} pts</span>
                <span
                  v-if="liveTask.epic"
                  class="edot"
                  :style="{ background: epicColor(liveTask) }"
                  :title="`Epic: ${liveTask.epic.name}`"
                />
              </div>
              <div class="stage-label">{{ coreStageLabel }}</div>
            </template>
            <div v-else class="rest">
              Loop at rest<br /><span class="rest-sub">no AI task executing</span>
            </div>
          </div>
        </div>

        <!-- ── Chips (HTML over SVG) ── -->
        <div
          v-for="c in placed.chips"
          :key="c.id"
          class="chip"
          :class="[
            `owner-${ownerOf(c.task)}`,
            {
              draft: isDraft(c.task),
              blocked: stationOf(c.task) === 'blocked',
              personal: c.task.scope === 'personal',
              ...chipHiClass(c.task),
            },
          ]"
          :style="{
            ...c.style,
            '--epic': epicColor(c.task),
            '--pts-w': chipWidth(c.task),
            'border-color':
              stationOf(c.task) === 'blocked'
                ? 'var(--status-critical)'
                : ownerMeta(ownerOf(c.task)).color,
          }"
          role="button"
          tabindex="0"
          :aria-label="`${shortName(c.task.name)} — ${stationLabelOf(c.task)} · ${ownerMeta(ownerOf(c.task)).label}`"
          @click="selectTask(c.task)"
          @keydown.enter.prevent="selectTask(c.task)"
          @keydown.space.prevent="selectTask(c.task)"
        >
          <div class="top">
            <component
              :is="OWNER_ICON[ownerOf(c.task)]"
              class="oico"
              :style="{ color: ownerMeta(ownerOf(c.task)).color }"
              aria-hidden="true"
            />
            <span
              v-if="c.task.epic"
              class="dot"
              :style="{ background: epicColor(c.task) }"
              :title="`Epic: ${c.task.epic.name}`"
              @mouseenter="hoverEpic = epicKey(c.task)"
              @mouseleave="hoverEpic = null"
            />
            <span class="name">{{ shortName(c.task.name) }}</span>
            <span class="glyphs">
              <a
                v-if="c.task.pr"
                :href="c.task.pr"
                target="_blank"
                rel="noopener noreferrer"
                class="link"
                title="Open pull request"
                @click.stop
              >
                <ExternalLink class="oico" />
              </a>
              <span v-if="c.task.hasFeedback" class="fb" title="Feedback awaiting tuning">◆</span>
            </span>
          </div>
          <span class="badge">
            <span class="ref">#{{ c.task.id ?? '—' }}</span>
            <template v-if="c.task.component"> · {{ c.task.component }}</template>
            <template v-if="c.task.points != null"> · {{ c.task.points }} pts</template>
            <template v-if="c.task.scope === 'personal'"> · {{ scopeBadge('personal').label }}</template>
          </span>
          <span
            v-if="loopStageLabel(c.task.loopStatus, statuses)"
            class="loop"
            :style="{ color: 'var(--muted-foreground)' }"
          >
            {{ loopStageLabel(c.task.loopStatus, statuses) }}
          </span>
        </div>

        <!-- +N overflow tokens -->
        <div
          v-for="o in placed.overflow"
          :key="`ov-${o.key}`"
          class="chip overflow"
          :style="{ ...o.style, '--ov-color': stationColor(o.key) }"
          role="button"
          tabindex="0"
          :aria-label="`${o.label} at ${o.key}`"
          @click="toggleOverflow(o.key)"
          @keydown.enter.prevent="toggleOverflow(o.key)"
          @keydown.space.prevent="toggleOverflow(o.key)"
        >
          {{ o.label }}
        </div>

        <!-- Reduced-motion LIVE badges (CSS-shown only under reduce) -->
        <span v-if="inProgressActive" class="livebadge" style="left: 445px; top: 148px">● LIVE</span>
        <span v-if="inReviewActive" class="livebadge" style="left: 792px; top: 250px">● LIVE</span>
      </div>

      <!-- Zoom toolbar (reuses the pan/zoom shell) -->
      <div class="toolbar">
        <button type="button" aria-label="Zoom in" @click="zoomIn"><Plus class="oico" /></button>
        <div class="z">{{ Math.round(view.scale * 100) }}%</div>
        <button type="button" aria-label="Zoom out" @click="zoomOut"><Minus class="oico" /></button>
        <button type="button" aria-label="Reset view" @click="reset"><RotateCcw class="oico" /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Every stroke/fill references an app token so light/dark + data-scheme track
   automatically. --beat-duration is the only bespoke prop (carries no color). */

/* Visually hidden but exposed to assistive tech (the SVG board is aria-hidden). */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.ico,
.oico {
  width: 0.85em;
  height: 0.85em;
  flex: 0 0 auto;
}
.oico {
  width: 12px;
  height: 12px;
}

/* ---------- Legend ---------- */
.legend {
  position: absolute;
  left: 8px;
  bottom: 8px;
  z-index: 10;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  background: color-mix(in oklab, var(--card) 90%, transparent);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px 10px;
  box-shadow: var(--shadow, 0 1px 2px rgb(0 0 0 / 0.08));
  font-size: 11px;
  color: var(--muted-foreground);
}
.legend .item {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.legend .sep {
  width: 1px;
  height: 14px;
  background: var(--border);
}
.legend .flowkey {
  width: 24px;
  height: 7px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--border);
  position: relative;
}
.legend .flowkey::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    var(--status-good) 0 6px,
    transparent 6px 12px
  );
}
.legend .flowkey.you::after {
  background: repeating-linear-gradient(
    90deg,
    var(--status-warning) 0 6px,
    transparent 6px 12px
  );
}
.legend .dashkey {
  width: 24px;
  border-top: 2px dashed var(--muted-foreground);
}
.legend .blockkey {
  width: 11px;
  height: 11px;
  border-radius: 4px;
  border: 2px dashed var(--status-critical);
}

/* ---------- Stage / pan-zoom shell ---------- */
.stage {
  position: relative;
  height: 70vh;
  min-height: 520px;
  max-height: 640px;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  background:
    radial-gradient(1200px 600px at 60% -10%, color-mix(in oklab, var(--chart-2) 6%, transparent), transparent 60%),
    var(--muted, transparent);
}
.stage:active {
  cursor: grabbing;
}
.stage::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.4;
  background-image:
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size: 36px 36px;
  -webkit-mask-image: radial-gradient(circle at 50% 45%, #000, transparent 85%);
  mask-image: radial-gradient(circle at 50% 45%, #000, transparent 85%);
}
.board {
  position: absolute;
  top: 0;
  left: 0;
  width: 920px;
  height: 640px;
  transform-origin: 0 0;
  will-change: transform;
}
/* Direct-child only: must NOT match the nested lucide icon <svg>s in chips /
   core / legend / toolbar (that made them fill the whole board). */
.board > svg {
  position: absolute;
  inset: 0;
  width: 920px;
  height: 640px;
  overflow: visible;
}

/* ---------- SVG copper traces ---------- */
.trace-base {
  fill: none;
  stroke: var(--border);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.trace-overlay {
  fill: none;
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 14 12;
  transition: opacity 0.3s ease;
}
.trace-overlay.ai {
  stroke: var(--status-good);
}
.trace-overlay.you {
  stroke: var(--status-warning);
}
.trace-return {
  fill: none;
  stroke: var(--border);
  stroke-width: 8;
  stroke-linecap: round;
}
.trace-return-pulse {
  fill: none;
  stroke: var(--chart-1);
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 20 640;
  opacity: 0;
}
.spur {
  fill: none;
  stroke: var(--status-critical);
  stroke-width: 6;
  stroke-linecap: round;
  stroke-dasharray: 9 8;
  opacity: 0.6;
}
.spur-ground {
  stroke: var(--status-critical);
  stroke-width: 4;
  stroke-linecap: round;
  opacity: 0.7;
}
.packet {
  fill: var(--status-good);
  filter: drop-shadow(0 0 5px var(--status-good));
}
.packet.you {
  fill: var(--status-warning);
  filter: drop-shadow(0 0 5px var(--status-warning));
}

/* ---------- Stations ---------- */
.station .pad {
  fill: var(--card);
  stroke: var(--border);
  stroke-width: 2.5;
}
.station.glow .pad {
  stroke: var(--status-good);
  filter: drop-shadow(0 0 8px color-mix(in oklab, var(--status-good) 60%, transparent));
}
.station .ring {
  fill: none;
  stroke: var(--border);
  stroke-width: 1.5;
}
.station text {
  fill: var(--foreground);
  font-size: 13px;
  font-weight: 600;
  dominant-baseline: middle;
}
.station .count {
  fill: var(--muted-foreground);
  font-weight: 600;
}
.station.blocked .pad {
  fill: var(--card);
  stroke: var(--status-critical);
  stroke-dasharray: 5 4;
}
.station.blocked text {
  fill: var(--status-critical);
}

/* ---------- Loop core ---------- */
.corewrap {
  position: absolute;
  left: 450px;
  top: 355px;
  transform: translate(-50%, -50%);
  width: 210px;
  height: 184px;
}
.core {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  background: color-mix(in oklab, var(--card) 88%, transparent);
  border: 1px solid var(--border);
  backdrop-filter: blur(3px);
  box-shadow: var(--shadow, 0 6px 20px rgb(0 0 0 / 0.08));
  display: flex;
  flex-direction: column;
  padding: 12px 13px;
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.2s ease;
}
.core:hover {
  transform: scale(1.02);
  border-color: var(--chart-2);
}
.core:focus-visible {
  outline: none;
  border-color: var(--chart-2);
  box-shadow:
    0 0 0 3px color-mix(in oklab, var(--chart-2) 35%, transparent),
    var(--shadow, 0 6px 20px rgb(0 0 0 / 0.08));
}
.core::before {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 22px;
  pointer-events: none;
  border: 2px solid var(--status-good);
  opacity: 0;
}
.core .k {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  font-weight: 700;
  display: flex;
  align-items: center;
}
.core .beatdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-good);
  display: inline-block;
  margin-right: 6px;
}
.core .iter {
  font-size: 14px;
  font-weight: 650;
  margin-top: 6px;
  line-height: 1.25;
  color: var(--foreground);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.core .meta {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 8px;
  flex-wrap: wrap;
}
.core .stage-label {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: auto;
  padding-top: 6px;
}
.core .ownerchip {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 20px;
  border: 1.5px solid var(--chart-1);
}
.core .pts {
  font-size: 11px;
  font-weight: 700;
  background: var(--muted);
  color: var(--foreground);
  padding: 2px 7px;
  border-radius: 20px;
}
.core .edot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.core.idle {
  cursor: default;
  opacity: 0.7;
}
.core.idle::before {
  animation: none;
}
.core .rest {
  color: var(--muted-foreground);
  font-size: 13px;
  margin: auto 0;
  text-align: center;
}
.core .rest-sub {
  font-size: 11px;
}

/* ---------- Chips ---------- */
.chip {
  position: absolute;
  transform: translate(-50%, -50%);
  min-width: var(--pts-w, 104px);
  max-width: 156px;
  background: var(--card);
  border: 2px solid var(--muted-foreground);
  border-radius: 10px;
  padding: 6px 8px 7px;
  box-shadow: var(--shadow, 0 1px 2px rgb(0 0 0 / 0.08));
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.18s ease, opacity 0.18s ease;
  z-index: 5;
}
.chip:hover,
.chip:focus-visible {
  transform: translate(-50%, -50%) scale(1.05);
  outline: none;
  box-shadow:
    0 0 0 3px color-mix(in oklab, var(--chart-2) 35%, transparent),
    var(--shadow, 0 1px 2px rgb(0 0 0 / 0.08));
  z-index: 9;
}
.chip .top {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 3px;
}
.chip .dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--epic, var(--chart-1));
  flex: 0 0 auto;
  cursor: help;
}
.chip .name {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  color: var(--foreground);
}
.chip .glyphs {
  display: inline-flex;
  gap: 3px;
  align-items: center;
  flex: 0 0 auto;
}
.chip .badge {
  font-size: 10px;
  color: var(--muted-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.chip .ref {
  font-size: 10px;
  font-weight: 700;
  opacity: 0.85;
}
.chip .link {
  color: var(--status-warning);
  display: inline-flex;
}
.chip .fb {
  color: var(--status-warning);
  font-size: 10px;
}
.chip .loop {
  display: block;
  margin-top: 2px;
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip.owner-parked {
  opacity: 0.9;
}
.chip.personal {
  box-shadow:
    0 0 0 2px color-mix(in oklab, var(--scope-personal) 45%, transparent),
    var(--shadow, 0 1px 2px rgb(0 0 0 / 0.08));
}
.chip.draft {
  border-style: dashed !important;
  background: repeating-linear-gradient(
    135deg,
    var(--card) 0 6px,
    color-mix(in oklab, var(--muted) 60%, transparent) 6px 12px
  );
}
.chip.blocked {
  box-shadow:
    0 0 0 3px color-mix(in oklab, var(--status-critical) 22%, transparent),
    var(--shadow, 0 1px 2px rgb(0 0 0 / 0.08));
}
.chip.dim {
  opacity: 0.28;
  filter: saturate(0.6);
}
.chip.hi {
  box-shadow:
    0 0 0 3px color-mix(in oklab, var(--epic) 55%, transparent),
    var(--shadow, 0 1px 2px rgb(0 0 0 / 0.08));
}
.chip.overflow {
  min-width: 0;
  text-align: center;
  border-style: dashed !important;
  border-color: var(--ov-color, var(--status-critical)) !important;
  font-size: 12px;
  font-weight: 700;
  color: var(--ov-color, var(--status-critical));
  padding: 8px 12px;
}

/* ---------- Toolbar (zoom) ---------- */
.toolbar {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 20;
}
.toolbar button {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground);
  cursor: pointer;
  box-shadow: var(--shadow, 0 1px 2px rgb(0 0 0 / 0.08));
  display: flex;
  align-items: center;
  justify-content: center;
}
.toolbar button:hover {
  border-color: var(--chart-2);
}
.toolbar .z {
  font-size: 11px;
  color: var(--muted-foreground);
  text-align: center;
}

/* ---------- Reduced-motion LIVE badge ---------- */
.livebadge {
  display: none;
}

/* ---------- Animations (motion-allowed only) ---------- */
@media (prefers-reduced-motion: no-preference) {
  .trace-overlay.flowing {
    animation: flow 3.6s linear infinite;
  }
  @keyframes flow {
    to {
      stroke-dashoffset: -260;
    }
  }
  .trace-overlay.you.flowing {
    animation-duration: 5.2s; /* calmer / slower amber you-flow */
  }
  .trace-return-pulse.flowing {
    animation: returnpulse 5.5s ease-in-out infinite;
  }
  @keyframes returnpulse {
    0% {
      stroke-dashoffset: 0;
      opacity: 0;
    }
    8% {
      opacity: 0.9;
    }
    92% {
      opacity: 0.9;
    }
    100% {
      stroke-dashoffset: -660;
      opacity: 0;
    }
  }
  .legend .flowkey::after {
    animation: legendflow 0.9s linear infinite;
  }
  @keyframes legendflow {
    to {
      background-position: 12px 0;
    }
  }
  .core:not(.idle)::before {
    animation: beat var(--beat-duration) ease-out infinite;
  }
  @keyframes beat {
    0% {
      transform: scale(0.98);
      opacity: 0.55;
    }
    70% {
      transform: scale(1.06);
      opacity: 0;
    }
    100% {
      opacity: 0;
    }
  }
  .core:not(.idle) .beatdot {
    animation: beatdot var(--beat-duration) ease-in-out infinite;
  }
  @keyframes beatdot {
    0%,
    100% {
      transform: scale(0.7);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.15);
      opacity: 1;
    }
  }
  /* Off-screen / hidden tab → freeze every running animation. */
  .stage.paused :is(.trace-overlay, .trace-return-pulse),
  .stage.paused .core::before,
  .stage.paused .core .beatdot {
    animation-play-state: paused !important;
  }
}

/* Reduced motion: freeze to a static lit trace + a LIVE badge. */
@media (prefers-reduced-motion: reduce) {
  .packet {
    display: none;
  }
  .livebadge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 8;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--status-good);
    background: color-mix(in oklab, var(--status-good) 16%, var(--card));
    border: 1px solid var(--status-good);
    border-radius: 6px;
    padding: 1px 5px;
  }
}
</style>
