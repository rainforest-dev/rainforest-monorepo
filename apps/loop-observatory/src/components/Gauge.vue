<script setup lang="ts">
import { computed } from 'vue';

import { formatPct } from '@/utils/format';

const props = defineProps<{
  label: string;
  pct: number;
  caption?: string;
}>();

// Clamp for the arc geometry; the printed number still shows the true value.
const clamped = computed(() => Math.max(0, Math.min(100, props.pct)));

// Utilization → reserved status color. Thresholds: <60 good, <85 warning, else critical.
const statusVar = computed(() => {
  if (props.pct >= 85) return 'var(--status-critical)';
  if (props.pct >= 60) return 'var(--status-warning)';
  return 'var(--status-good)';
});

const statusLabel = computed(() => {
  if (props.pct >= 85) return 'critical';
  if (props.pct >= 60) return 'watch';
  return 'ok';
});

// Upper semicircle: left (10,60) → right (110,60), sweep-flag 1 arcs over the
// top. pathLength is normalized to 100 so the value dash is simply `<pct> 100`.
const ARC = 'M 10 60 A 50 50 0 0 1 110 60';
</script>

<template>
  <div class="flex flex-col items-center">
    <p class="text-muted-foreground text-xs font-medium">{{ label }}</p>
    <svg
      viewBox="0 0 120 74"
      class="mt-1 w-full max-w-[190px]"
      role="img"
      :aria-label="`${label}: ${formatPct(pct)} used, ${statusLabel}`"
    >
      <!-- track -->
      <path
        :d="ARC"
        fill="none"
        class="text-muted-foreground"
        stroke="currentColor"
        stroke-width="11"
        stroke-linecap="round"
        opacity="0.22"
      />
      <!-- value -->
      <path
        :d="ARC"
        fill="none"
        pathLength="100"
        :stroke="statusVar"
        :stroke-dasharray="`${clamped} 100`"
        stroke-width="11"
        stroke-linecap="round"
      />
      <text
        x="60"
        y="54"
        text-anchor="middle"
        class="fill-foreground"
        style="font-size: 16px; font-weight: 600"
      >
        {{ formatPct(pct) }}
      </text>
    </svg>
    <div class="flex items-center gap-1.5">
      <span
        class="inline-block size-2 rounded-full"
        :style="{ backgroundColor: statusVar }"
        aria-hidden="true"
      />
      <p class="text-muted-foreground text-center text-xs">
        {{ caption ?? statusLabel }}
      </p>
    </div>
  </div>
</template>
