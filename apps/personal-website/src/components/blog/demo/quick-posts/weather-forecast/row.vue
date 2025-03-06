<template>
  <tr>
    <td :title="format(date, 'yyyy-MM-dd')" class="px-4">
      {{ format(date, 'eee') }}
    </td>
    <td class="w-full flex-row-center gap-2 px-4 text-on-surface/60">
      <span>{{ tempMin }}°C</span>
      <span
        class="relative h-3 grow rounded-full bg-surface-container-high inset-shadow-sm"
      >
        <span
          class="absolute top-1/2 -translate-y-1/2 h-full rounded-[inherit] bg-linear-to-r from-(--color-from) to-(--color-to) transition-all indicator"
        ></span>
      </span>
      <span>{{ tempMax }}°C</span>
    </td>
  </tr>
</template>
<script lang="ts" setup>
import { computed } from 'vue';
import { format } from 'date-fns';

interface IProps {
  date: Date;
  tempMin: number;
  tempMax: number;
  lowerBound: number;
  upperBound: number;
}

const { date, tempMin, tempMax, lowerBound, upperBound } =
  defineProps<IProps>();

const tempMinRatio = computed(
  () => (tempMin - lowerBound) / (upperBound - lowerBound),
);
const tempMaxRatio = computed(
  () => (tempMax - lowerBound) / (upperBound - lowerBound),
);
</script>
<style scoped>
.indicator {
  --color-source-from: var(--color-teal-500);
  --color-source-to: var(--color-amber-300);
  left: calc(v-bind(tempMinRatio) * 100%);
  right: calc((1 - v-bind(tempMaxRatio)) * 100%);
  --color-from: color-mix(
    in oklab,
    var(--color-source-from),
    var(--color-source-to) calc(v-bind(tempMinRatio) * 100%)
  );
  --color-to: color-mix(
    in oklab,
    var(--color-source-from),
    var(--color-source-to) calc(v-bind(tempMaxRatio) * 100%)
  );
}
</style>
