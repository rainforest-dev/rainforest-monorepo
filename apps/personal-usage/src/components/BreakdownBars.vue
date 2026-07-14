<script setup lang="ts">
import { computed } from 'vue';

import type { Breakdown } from '@/lib/ledger';
import { formatInt, formatTokens, formatUsd } from '@/utils/format';

const props = defineProps<{ items: Breakdown[]; limit?: number }>();

const rows = computed(() => props.items.slice(0, props.limit ?? 15));
const maxCost = computed(() =>
  Math.max(1e-9, ...rows.value.map((r) => r.cost)),
);
const pct = (cost: number) => `${Math.max(1.5, (cost / maxCost.value) * 100)}%`;
</script>

<template>
  <div v-if="rows.length === 0" class="text-muted-foreground py-8 text-center text-sm">
    No data.
  </div>
  <ul v-else class="space-y-3.5">
    <li v-for="row in rows" :key="row.key" class="group">
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span class="text-foreground truncate font-medium" :title="row.key">
          {{ row.key }}
        </span>
        <span class="text-foreground shrink-0 tabular-nums font-medium">
          {{ formatUsd(row.cost) }}
        </span>
      </div>
      <div
        class="bg-muted mt-1.5 h-2 w-full overflow-hidden rounded-full"
        role="img"
        :aria-label="`${row.key}: ${formatUsd(row.cost)}`"
      >
        <div
          class="bg-primary h-full rounded-full transition-[width] duration-500"
          :style="{ width: pct(row.cost) }"
        />
      </div>
      <div
        class="text-muted-foreground mt-1 flex items-center justify-between text-xs tabular-nums"
      >
        <span>{{ formatTokens(row.tokens) }} tokens</span>
        <span>{{ formatInt(row.count) }} records</span>
      </div>
    </li>
  </ul>
</template>
