<script setup lang="ts">
import { CalendarClock, MonitorSmartphone } from '@lucide/vue';
import { useNow } from '@vueuse/core';
import { formatDistanceToNowStrict } from 'date-fns';
import { computed } from 'vue';

import Gauge from '@/components/Gauge.vue';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { MachineBudget, MachineBudgetMap } from '@/lib/budget';
import type { MachineBreakdown } from '@/lib/ledger';
import type { BudgetMode } from '@/lib/loop';
import { formatUsd } from '@/utils/format';

const props = defineProps<{
  budgets: MachineBudgetMap;
  byMachine: MachineBreakdown[];
  modes: Record<string, BudgetMode>;
}>();

const now = useNow({ interval: 30_000 });

// Reserved status colors paired with a text label — never color alone.
const MODE_META: Record<BudgetMode, { color: string; label: string }> = {
  green: { color: 'var(--status-good)', label: 'ok' },
  yellow: { color: 'var(--status-warning)', label: 'watch' },
  red: { color: 'var(--status-critical)', label: 'critical' },
  dark: { color: 'var(--muted-foreground)', label: 'stale' },
};

interface MachineView {
  name: string;
  budget: MachineBudget | null;
  ledger: MachineBreakdown | null;
  mode: BudgetMode;
}

const machines = computed<MachineView[]>(() => {
  const names = new Set<string>([
    ...Object.keys(props.budgets),
    ...props.byMachine.map((m) => m.key),
  ]);
  return [...names].sort().map((name) => ({
    name,
    budget: props.budgets[name] ?? null,
    ledger: props.byMachine.find((m) => m.key === name) ?? null,
    mode: props.modes[name] ?? 'dark',
  }));
});

function modeLabel(m: MachineView): string {
  if (m.mode !== 'dark') return MODE_META[m.mode].label;
  return m.budget?.claude ? 'stale' : 'no quota';
}

function lastSeenMs(m: MachineView): number | null {
  const candidates: number[] = [];
  if (m.budget?.written_at) candidates.push(m.budget.written_at * 1000);
  if (m.ledger?.last_ts) {
    const t = Date.parse(m.ledger.last_ts);
    if (!Number.isNaN(t)) candidates.push(t);
  }
  return candidates.length ? Math.max(...candidates) : null;
}

function lastSeen(m: MachineView): string | null {
  // `now` referenced so the relative label re-renders on the interval tick.
  void now.value;
  const ms = lastSeenMs(m);
  if (ms === null) return null;
  return formatDistanceToNowStrict(new Date(ms), { addSuffix: true });
}

function snapshotAge(m: MachineView): string | null {
  const w = m.budget?.written_at;
  if (!w) return null;
  void now.value;
  return `snapshot ${formatDistanceToNowStrict(new Date(w * 1000), { addSuffix: true })}`;
}

function codexReset(m: MachineView): string | undefined {
  const r = m.budget?.codex?.resets_at;
  if (!r) return undefined;
  void now.value;
  return `resets ${formatDistanceToNowStrict(new Date(r * 1000), { addSuffix: true })}`;
}
</script>

<template>
  <section>
    <div class="mb-3 flex items-center gap-2">
      <MonitorSmartphone class="text-muted-foreground size-4" />
      <h2 class="text-foreground text-lg font-semibold tracking-tight">Machines</h2>
      <span class="text-muted-foreground text-sm">
        {{ machines.length }} reporting
      </span>
    </div>

    <div
      v-if="machines.length === 0"
      class="text-muted-foreground border-border flex items-center gap-2 rounded-md border border-dashed px-4 py-8 text-sm"
    >
      <CalendarClock class="size-4" />
      No machines reporting yet — run the quota reader to populate
      <code class="text-foreground">_system/usage/quota.&lt;machine&gt;.json</code>.
    </div>

    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card v-for="m in machines" :key="m.name">
        <CardHeader>
          <div class="flex items-center justify-between gap-3">
            <CardTitle class="flex items-center gap-2 font-mono text-base">
              <span
                class="inline-block size-2.5 shrink-0 rounded-full"
                :style="{ backgroundColor: MODE_META[m.mode].color }"
                aria-hidden="true"
              />
              {{ m.name }}
            </CardTitle>
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :style="{
                color: MODE_META[m.mode].color,
                backgroundColor: 'color-mix(in oklab, ' + MODE_META[m.mode].color + ' 14%, transparent)',
              }"
            >
              {{ modeLabel(m) }}
            </span>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-3 gap-3">
            <template v-if="m.budget?.claude">
              <Gauge
                label="Claude · 5h"
                :pct="m.budget.claude.five_hour_pct"
                :caption="snapshotAge(m) ?? undefined"
              />
              <Gauge
                label="Claude · 7d"
                :pct="m.budget.claude.seven_day_pct"
                :caption="snapshotAge(m) ?? undefined"
              />
            </template>
            <div
              v-else
              class="text-muted-foreground col-span-2 flex items-center justify-center py-6 text-xs"
            >
              No Claude quota
            </div>

            <Gauge
              v-if="m.budget?.codex"
              label="Codex · used"
              :pct="m.budget.codex.used_pct"
              :caption="codexReset(m)"
            />
            <div
              v-else
              class="text-muted-foreground flex items-center justify-center py-6 text-xs"
            >
              No Codex quota
            </div>
          </div>

          <div
            class="border-border flex items-center justify-between border-t pt-3 text-sm"
          >
            <div>
              <p class="text-muted-foreground text-xs">Est. cost</p>
              <p class="text-foreground font-semibold tabular-nums">
                {{ m.ledger ? formatUsd(m.ledger.cost) : '—' }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-muted-foreground text-xs">Last seen</p>
              <p class="text-foreground tabular-nums">
                {{ lastSeen(m) ?? '—' }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
