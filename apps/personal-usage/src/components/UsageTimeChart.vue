<script setup lang="ts">
import { useElementSize } from '@vueuse/core';
import { format, parseISO } from 'date-fns';
import { computed, ref } from 'vue';

import type { DailyPoint } from '@/lib/ledger';
import { formatTokens, formatUsdPrecise } from '@/utils/format';

const props = defineProps<{ series: DailyPoint[] }>();

const wrap = ref<HTMLDivElement | null>(null);
const { width } = useElementSize(wrap);

// Geometry (user units == px because the SVG renders at container width).
const PAD_L = 14;
const PAD_R = 14;
const COST_TOP = 12;
const COST_H = 116;
const TOK_TOP = 168;
const TOK_H = 78;
const H = 272;
const COST_BASE = COST_TOP + COST_H; // 128
const TOK_BASE = TOK_TOP + TOK_H; // 246
const GAP = 2; // surface gap between adjacent bars / stacked segments

const W = computed(() => Math.max(width.value || 0, 320));
const plotW = computed(() => W.value - PAD_L - PAD_R);
const n = computed(() => props.series.length);
const bandW = computed(() => (n.value > 0 ? plotW.value / n.value : plotW.value));
const center = (i: number) => PAD_L + (i + 0.5) * bandW.value;

const maxCost = computed(() =>
  Math.max(1e-9, ...props.series.map((d) => d.cost)),
);
const maxTok = computed(() =>
  Math.max(1, ...props.series.map((d) => d.tokens_in + d.tokens_out)),
);

const costY = (v: number) => COST_BASE - (v / maxCost.value) * COST_H;

const costArea = computed(() => {
  if (n.value === 0) return '';
  const pts = props.series.map((d, i) => `${center(i)},${costY(d.cost)}`);
  return `M ${PAD_L},${COST_BASE} L ${center(0)},${COST_BASE} L ${pts.join(
    ' L ',
  )} L ${center(n.value - 1)},${COST_BASE} L ${W.value - PAD_R},${COST_BASE} Z`;
});

const costLine = computed(() => {
  if (n.value === 0) return '';
  return 'M ' + props.series.map((d, i) => `${center(i)},${costY(d.cost)}`).join(' L ');
});

const barInnerW = computed(() => Math.max(1, bandW.value - GAP));

interface Bar {
  x: number;
  inY: number;
  inH: number;
  outY: number;
  outH: number;
}
const bars = computed<Bar[]>(() =>
  props.series.map((d, i) => {
    const inH = (d.tokens_in / maxTok.value) * TOK_H;
    const outH = (d.tokens_out / maxTok.value) * TOK_H;
    const x = PAD_L + i * bandW.value + GAP / 2;
    const inY = TOK_BASE - inH;
    // 2px surface gap between the two stacked segments
    const outY = inY - GAP - outH;
    return { x, inY, inH, outY: outH > 0 ? outY : inY, outH };
  }),
);

// x-axis ticks: up to 6 evenly spaced date labels.
const ticks = computed(() => {
  if (n.value === 0) return [] as { x: number; label: string }[];
  const count = Math.min(6, n.value);
  const step = n.value <= 1 ? 1 : (n.value - 1) / (count - 1);
  const seen = new Set<number>();
  const out: { x: number; label: string }[] = [];
  for (let k = 0; k < count; k++) {
    const i = Math.round(k * step);
    if (seen.has(i)) continue;
    seen.add(i);
    out.push({ x: center(i), label: format(parseISO(props.series[i].date), 'MMM d') });
  }
  return out;
});

// ── Hover ────────────────────────────────────────────────────────────────
const svgRef = ref<SVGSVGElement | null>(null);
const hoverIdx = ref<number | null>(null);

function onMove(e: MouseEvent) {
  if (n.value === 0 || !svgRef.value) return;
  const rect = svgRef.value.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const i = Math.floor((x - PAD_L) / bandW.value);
  hoverIdx.value = Math.max(0, Math.min(n.value - 1, i));
}

const hovered = computed(() =>
  hoverIdx.value === null ? null : props.series[hoverIdx.value],
);
const hoverX = computed(() =>
  hoverIdx.value === null ? 0 : center(hoverIdx.value),
);
const tooltipStyle = computed(() => {
  const cx = hoverX.value;
  const side = cx > W.value / 2 ? { right: `${W.value - cx + 8}px` } : { left: `${cx + 8}px` };
  return { top: '8px', ...side };
});
</script>

<template>
  <div ref="wrap" class="relative w-full">
    <div v-if="n === 0" class="text-muted-foreground py-16 text-center text-sm">
      No usage recorded yet.
    </div>

    <template v-else>
      <!-- panel titles + legend -->
      <div class="mb-1 flex items-baseline justify-between">
        <span class="text-muted-foreground text-xs font-medium">
          Est. cost / day
        </span>
      </div>

      <svg
        ref="svgRef"
        :viewBox="`0 0 ${W} ${H}`"
        :width="W"
        :height="H"
        class="block h-auto w-full"
        @mousemove="onMove"
        @mouseleave="hoverIdx = null"
      >
        <!-- cost baseline -->
        <line
          :x1="PAD_L"
          :y1="COST_BASE"
          :x2="W - PAD_R"
          :y2="COST_BASE"
          class="stroke-border"
          stroke-width="1"
        />
        <path :d="costArea" fill="var(--primary)" opacity="0.14" />
        <path
          :d="costLine"
          fill="none"
          stroke="var(--primary)"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- tokens baseline -->
        <line
          :x1="PAD_L"
          :y1="TOK_BASE"
          :x2="W - PAD_R"
          :y2="TOK_BASE"
          class="stroke-border"
          stroke-width="1"
        />
        <g v-for="(b, i) in bars" :key="i">
          <rect
            :x="b.x"
            :y="b.inY"
            :width="barInnerW"
            :height="b.inH"
            rx="1"
            fill="var(--chart-2)"
          />
          <rect
            v-if="b.outH > 0"
            :x="b.x"
            :y="b.outY"
            :width="barInnerW"
            :height="b.outH"
            rx="1"
            fill="var(--chart-1)"
          />
        </g>

        <!-- crosshair + hover markers -->
        <template v-if="hoverIdx !== null && hovered">
          <line
            :x1="hoverX"
            :y1="COST_TOP"
            :x2="hoverX"
            :y2="TOK_BASE"
            class="stroke-muted-foreground"
            stroke-width="1"
            stroke-dasharray="3 3"
            opacity="0.7"
          />
          <circle
            :cx="hoverX"
            :cy="costY(hovered.cost)"
            r="3.5"
            fill="var(--primary)"
            class="stroke-background"
            stroke-width="1.5"
          />
        </template>

        <!-- x ticks -->
        <text
          v-for="t in ticks"
          :key="t.label"
          :x="t.x"
          :y="H - 6"
          text-anchor="middle"
          class="fill-muted-foreground"
          style="font-size: 10px"
        >
          {{ t.label }}
        </text>

        <!-- tokens panel label -->
        <text
          :x="PAD_L"
          :y="TOK_TOP - 6"
          class="fill-muted-foreground"
          style="font-size: 11px; font-weight: 500"
        >
          Tokens / day
        </text>
      </svg>

      <!-- legend (tokens are two series → legend required) -->
      <div class="text-muted-foreground mt-1 flex items-center gap-4 text-xs">
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block size-2.5 rounded-sm"
            style="background: var(--chart-2)"
          />
          tokens in
        </span>
        <span class="flex items-center gap-1.5">
          <span
            class="inline-block size-2.5 rounded-sm"
            style="background: var(--chart-1)"
          />
          tokens out
        </span>
      </div>

      <!-- tooltip -->
      <div
        v-if="hovered"
        class="border-border bg-popover text-popover-foreground pointer-events-none absolute z-10 rounded-md border px-3 py-2 text-xs shadow-md"
        :style="tooltipStyle"
      >
        <p class="text-foreground font-medium">
          {{ format(parseISO(hovered.date), 'EEE, MMM d yyyy') }}
        </p>
        <p class="mt-1">
          <span class="text-muted-foreground">cost</span>
          <span class="text-foreground ml-1 font-medium">{{
            formatUsdPrecise(hovered.cost)
          }}</span>
        </p>
        <p>
          <span class="text-muted-foreground">tokens</span>
          <span class="text-foreground ml-1 font-medium"
            >{{ formatTokens(hovered.tokens_in) }} in /
            {{ formatTokens(hovered.tokens_out) }} out</span
          >
        </p>
      </div>
    </template>
  </div>
</template>
