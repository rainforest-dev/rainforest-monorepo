<script setup lang="ts">
import { CalendarClock, MonitorSmartphone } from '@lucide/vue';
import { useNow } from '@vueuse/core';
import { formatDistanceToNowStrict } from 'date-fns';
import { computed } from 'vue';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
// Type-only imports: this is a client-hydrated island, so importing runtime
// values from budget.ts would drag its node:fs/node:path deps into the browser
// bundle. The staleness threshold + lag math are inlined below (mirroring the
// server-tested `providerStale` / `sourceLagMinutes` in budget.ts).
import type {
  MachineBudget,
  MachineBudgetMap,
  QuotaBar,
} from '@/lib/budget';
import type { MachineBreakdown } from '@/lib/ledger';
import type { BudgetMode } from '@/lib/loop';
import { formatInt, formatPct, formatUsd } from '@/utils/format';

const props = defineProps<{
  budgets: MachineBudgetMap;
  byMachine: MachineBreakdown[];
  modes: Record<string, BudgetMode>;
}>();

// Relative labels ("2 min ago", "resets in 3h") re-render on this tick.
const now = useNow({ interval: 30_000 });

// Reserved status colors, always paired with a text label — never color alone.
const MODE_META: Record<BudgetMode, { color: string; label: string }> = {
  green: { color: 'var(--status-good)', label: 'ok' },
  yellow: { color: 'var(--status-warning)', label: 'watch' },
  red: { color: 'var(--status-critical)', label: 'critical' },
  dark: { color: 'var(--muted-foreground)', label: 'stale' },
};

const STALE_TAG_STYLE = {
  color: 'var(--status-warning)',
  backgroundColor: 'color-mix(in oklab, var(--status-warning) 16%, transparent)',
};

// A provider window is stale when its captured source lags the machine's
// `written_at` by more than this many minutes.
const PROVIDER_STALE_MIN = 10;

/** Minutes the provider source lags `written_at`; `null` when unknowable. */
function sourceLag(
  writtenAt: number | null,
  sourceTs: number | null | undefined,
): number | null {
  if (writtenAt === null || sourceTs === null || sourceTs === undefined) return null;
  return (writtenAt - sourceTs) / 60;
}

// ── View-model shapes ──────────────────────────────────────────────────────
interface BarView {
  label: string;
  pct: number;
  color: string;
  status: 'ok' | 'watch' | 'critical';
  reset: string | null;
}
interface QuotaSection {
  kind: 'quota';
  name: string;
  stale: boolean;
  staleTitle?: string;
  bars: BarView[];
}
interface AgySection {
  kind: 'agy';
  stale: boolean;
  staleTitle?: string;
  cost: string | null;
  activity: string | null;
}
type Section = QuotaSection | AgySection;

interface Card {
  name: string;
  mode: BudgetMode;
  modeLabel: string;
  planBadges: string[];
  lastSeen: string | null;
  ledgerCost: string | null;
  sections: Section[];
}

// ── Pure helpers ─────────────────────────────────────────────────────────────
function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function statusOf(pct: number): 'ok' | 'watch' | 'critical' {
  // Bar fill: green < 60, amber 60–85, red > 85.
  if (pct > 85) return 'critical';
  if (pct >= 60) return 'watch';
  return 'ok';
}

function barColor(status: 'ok' | 'watch' | 'critical'): string {
  if (status === 'critical') return 'var(--status-critical)';
  if (status === 'watch') return 'var(--status-warning)';
  return 'var(--status-good)';
}

function relative(sec: number): string {
  return formatDistanceToNowStrict(new Date(sec * 1000), { addSuffix: true });
}

function resetLabel(resets_at: number | null): string | null {
  if (!resets_at) return null;
  // A reset timestamp in the past is an error state: the window already rolled
  // over, so this reading is stale/invalid — never render it as "N ago".
  if (resets_at * 1000 <= Date.now()) return '⚠ reset overdue';
  return `resets ${relative(resets_at)}`;
}

function humanizeLag(min: number): string {
  if (min >= 1440) return `${Math.round(min / 1440)}d`;
  if (min >= 60) return `${Math.round(min / 60)}h`;
  return `${Math.round(min)}m`;
}

function toBar(b: QuotaBar): BarView {
  const status = statusOf(b.used_pct);
  return {
    label: b.label,
    pct: b.used_pct,
    color: barColor(status),
    status,
    reset: resetLabel(b.resets_at),
  };
}

/** Stale when a provider's captured source lags the snapshot's `written_at` > 10 min. */
function staleInfo(
  writtenAt: number | null,
  sourceTs: number | null | undefined,
): { stale: boolean; staleTitle?: string } {
  const lag = sourceLag(writtenAt, sourceTs);
  if (lag === null || lag <= PROVIDER_STALE_MIN) return { stale: false };
  return {
    stale: true,
    staleTitle: `Reading is ${humanizeLag(lag)} older than this machine's last report`,
  };
}

function planBadges(b: MachineBudget | null): string[] {
  const plans = new Set<string>();
  if (b?.claude?.plan) plans.add(b.claude.plan);
  if (b?.codex?.plan) plans.add(b.codex.plan);
  return [...plans].map(titleCase);
}

function lastSeenMs(
  b: MachineBudget | null,
  ledger: MachineBreakdown | null,
): number | null {
  const secs: number[] = [];
  if (b?.written_at) secs.push(b.written_at);
  if (b?.claude?.source_ts) secs.push(b.claude.source_ts);
  if (b?.codex?.source_ts) secs.push(b.codex.source_ts);
  if (b?.agy?.source_ts) secs.push(b.agy.source_ts);
  if (secs.length) return Math.max(...secs) * 1000;
  if (ledger?.last_ts) {
    const t = Date.parse(ledger.last_ts);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

function buildSections(b: MachineBudget | null): Section[] {
  if (!b) return [];
  const w = b.written_at;
  const sections: Section[] = [];

  if (b.claude) {
    sections.push({
      kind: 'quota',
      name: 'Claude',
      ...staleInfo(w, b.claude.source_ts),
      bars: b.claude.bars.map(toBar),
    });
  }
  if (b.codex) {
    sections.push({
      kind: 'quota',
      name: 'Codex',
      ...staleInfo(w, b.codex.source_ts),
      bars: b.codex.bars.map(toBar),
    });
  }
  if (b.agy) {
    const a = b.agy;
    sections.push({
      kind: 'agy',
      ...staleInfo(w, a.source_ts),
      cost: a.cost_est_usd != null ? formatUsd(a.cost_est_usd) : null,
      activity: a.activity
        ? `${formatInt(a.activity.prompts_7d)} prompts · ${formatInt(a.activity.sessions_7d)} sessions (7d)`
        : null,
    });
  }
  return sections;
}

// ── Cards ─────────────────────────────────────────────────────────────────────
const cards = computed<Card[]>(() => {
  // Reference `now` so relative labels (last seen / resets) recompute on tick.
  void now.value;

  const names = new Set<string>([
    ...Object.keys(props.budgets),
    ...props.byMachine.map((m) => m.key),
  ]);

  return [...names].sort().map((name) => {
    const budget = props.budgets[name] ?? null;
    const ledger = props.byMachine.find((m) => m.key === name) ?? null;
    const mode = props.modes[name] ?? 'dark';
    const ms = lastSeenMs(budget, ledger);
    const modeLabel =
      mode !== 'dark' ? MODE_META[mode].label : budget?.claude ? 'stale' : 'no quota';

    return {
      name,
      mode,
      modeLabel,
      planBadges: planBadges(budget),
      lastSeen: ms === null ? null : relative(ms / 1000),
      ledgerCost: ledger ? formatUsd(ledger.cost) : null,
      sections: buildSections(budget),
    };
  });
});
</script>

<template>
  <section>
    <div class="mb-3 flex items-center gap-2">
      <MonitorSmartphone class="text-muted-foreground size-4" />
      <h2 class="text-foreground text-lg font-semibold tracking-tight">Machines</h2>
      <span class="text-muted-foreground text-sm">{{ cards.length }} reporting</span>
    </div>

    <div
      v-if="cards.length === 0"
      class="text-muted-foreground border-border flex items-center gap-2 rounded-md border border-dashed px-4 py-8 text-sm"
    >
      <CalendarClock class="size-4" />
      No machines reporting yet — run the quota reader to populate
      <code class="text-foreground">_system/usage/quota.&lt;machine&gt;.json</code>.
    </div>

    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card v-for="card in cards" :key="card.name">
        <CardHeader>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <CardTitle class="flex items-center gap-2 font-mono text-base">
                <span
                  class="inline-block size-2.5 shrink-0 rounded-full"
                  :style="{ backgroundColor: MODE_META[card.mode].color }"
                  role="img"
                  :aria-label="`status: ${card.modeLabel}`"
                />
                <span class="truncate">{{ card.name }}</span>
              </CardTitle>
              <p class="text-muted-foreground mt-1 text-xs">
                Last seen {{ card.lastSeen ?? '—' }}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              <Badge
                v-for="p in card.planBadges"
                :key="p"
                variant="secondary"
                class="tracking-wide"
              >
                {{ p }}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <template v-if="card.sections.length">
            <div
              v-for="(section, i) in card.sections"
              :key="section.kind + i"
              :class="i > 0 ? 'border-border mt-4 border-t pt-4' : ''"
            >
              <!-- Provider group header (name + optional stale tag) -->
              <div class="mb-2 flex items-center gap-2">
                <span class="text-foreground text-sm font-medium">
                  {{ section.kind === 'agy' ? 'agy' : section.name }}
                </span>
                <Badge
                  v-if="section.kind === 'agy'"
                  variant="outline"
                  class="text-[10px] uppercase"
                >
                  est.
                </Badge>
                <span
                  v-if="section.stale"
                  class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  :style="STALE_TAG_STYLE"
                  :title="section.staleTitle"
                >
                  stale
                </span>
              </div>

              <!-- Quota bars -->
              <div v-if="section.kind === 'quota'" class="space-y-2.5">
                <div v-for="bar in section.bars" :key="bar.label" class="space-y-1">
                  <div class="flex items-baseline justify-between gap-2 text-xs">
                    <span class="text-foreground truncate">{{ bar.label }}</span>
                    <span class="text-muted-foreground shrink-0 tabular-nums">
                      {{ formatPct(bar.pct) }}<template v-if="bar.reset">
                        · {{ bar.reset }}</template>
                    </span>
                  </div>
                  <div
                    class="bg-muted h-2 w-full overflow-hidden rounded-full"
                    role="img"
                    :aria-label="`${bar.label}: ${formatPct(bar.pct)} used, ${bar.status}`"
                  >
                    <div
                      class="h-full rounded-full"
                      :style="{
                        width: Math.min(100, Math.max(0, bar.pct)) + '%',
                        backgroundColor: bar.color,
                      }"
                    />
                  </div>
                </div>
              </div>

              <!-- agy estimated block (no quota bar) -->
              <div v-else>
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-foreground text-lg font-semibold tabular-nums">
                    {{ section.cost ?? '—' }}
                  </span>
                  <span class="text-muted-foreground text-xs">
                    {{ section.activity ?? 'no recent activity' }}
                  </span>
                </div>
                <p class="text-muted-foreground mt-0.5 text-[11px]">
                  estimated · agy reports no quota
                </p>
              </div>
            </div>
          </template>

          <div
            v-else
            class="text-muted-foreground flex items-center justify-center rounded-md border border-dashed py-6 text-xs"
          >
            No quota reported for this machine.
          </div>

          <!-- Per-machine ledger cost -->
          <div
            v-if="card.ledgerCost"
            class="border-border mt-4 flex items-center justify-between border-t pt-3 text-sm"
          >
            <p class="text-muted-foreground text-xs">Est. cost (this machine)</p>
            <p class="text-foreground font-semibold tabular-nums">{{ card.ledgerCost }}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
