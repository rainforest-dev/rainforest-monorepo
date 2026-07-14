<script setup lang="ts">
import { CircleDollarSign, Database, Layers, Radio } from '@lucide/vue';
import { computed } from 'vue';

import { Card, CardContent } from '@/components/ui/card';
import type { Totals } from '@/lib/ledger';
import { formatInt, formatTokens, formatUsd } from '@/utils/format';

const props = defineProps<{ totals: Totals }>();

const tiles = computed(() => [
  {
    label: 'Total est. cost',
    value: formatUsd(props.totals.cost_est_usd),
    sub: `${formatInt(props.totals.record_count)} records`,
    icon: CircleDollarSign,
  },
  {
    label: 'Tokens in / out',
    value: `${formatTokens(props.totals.tokens_in)} / ${formatTokens(props.totals.tokens_out)}`,
    sub: `${formatTokens(props.totals.cache)} cached`,
    icon: Database,
  },
  {
    label: 'Sessions',
    value: formatInt(props.totals.session_count),
    sub: 'distinct session ids',
    icon: Radio,
  },
  {
    label: 'Records',
    value: formatInt(props.totals.record_count),
    sub: 'ledger entries',
    icon: Layers,
  },
]);
</script>

<template>
  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    <Card v-for="tile in tiles" :key="tile.label">
      <CardContent class="p-5">
        <div class="flex items-start justify-between gap-2">
          <p class="text-muted-foreground text-sm font-medium">
            {{ tile.label }}
          </p>
          <component :is="tile.icon" class="text-muted-foreground size-4" />
        </div>
        <p class="text-foreground mt-2 text-2xl font-semibold tracking-tight">
          {{ tile.value }}
        </p>
        <p class="text-muted-foreground mt-1 text-xs">{{ tile.sub }}</p>
      </CardContent>
    </Card>
  </div>
</template>
