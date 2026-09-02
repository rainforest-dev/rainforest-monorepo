<script setup lang="ts">
import { CalendarClock, MonitorSmartphone, Split } from '@lucide/vue';
import { useNow } from '@vueuse/core';
import { formatDistanceToNowStrict } from 'date-fns';
import { computed } from 'vue';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// Type-only imports: this is a client-hydrated island, so importing runtime
// values from budget.ts would drag its node:fs/node:path deps into the browser
// bundle. The staleness threshold + lag math are inlined below (mirroring the
// server-tested `providerStale` / `sourceLagMinutes` in budget.ts).
import type { MachineBudget, MachineBudgetMap, QuotaBar } from '@/lib/budget';
import type { MachineBreakdown } from '@/lib/ledger';
import type { BudgetMode } from '@/lib/loop';
// machineReadings.ts is deliberately node-free, so these are real runtime
// imports and the rules they encode are unit-tested rather than restated here.
import {
  type Disagreement,
  disagreement,
  HALT_AT_PCT,
  HALT_MARKER_LABEL,
  type HostReadings,
  isFiveHourWindow,
  isWindowUnknown,
  readingPills,
  remainingColor,
  remainingPct,
  type RemainingStatus,
  remainingStatus,
  type SourcePill,
  unknownNote,
} from '@/lib/machineReadings';
import { formatInt, formatPct, formatUsd } from '@/utils/format';

const props = defineProps<{
  budgets: MachineBudgetMap;
  byMachine: MachineBreakdown[];
  modes: Record<string, BudgetMode>;
  /**
   * The second reading, from `/api/enroll/hosts`. Optional: when the enrollment
   * API is unreachable the card shows one source and says so, rather than
   * presenting the snapshot alone as if it had been corroborated.
   */
  readings?: Record<string, HostReadings>;
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
  backgroundColor:
    'color-mix(in oklab, var(--status-warning) 16%, transparent)',
};

const LIVE_TAG_STYLE = {
  color: 'var(--status-good)',
  backgroundColor: 'color-mix(in oklab, var(--status-good) 14%, transparent)',
};

/**
 * A window with no current figure. Diagonal hatching over the whole track,
 * because the two shapes a reader already knows — an empty bar and a full one —
 * are both confident claims about a number that does not exist.
 */
const UNKNOWN_TRACK_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(135deg, color-mix(in oklab, var(--status-warning) 34%, transparent) 0 4px, transparent 4px 8px)',
  borderColor: 'color-mix(in oklab, var(--status-warning) 55%, transparent)',
};

const CONFLICT_BOX_STYLE = {
  borderColor: 'color-mix(in oklab, var(--status-warning) 55%, transparent)',
  backgroundColor: 'color-mix(in oklab, var(--status-warning) 8%, transparent)',
};

// A provider window is stale when its captured source lags the machine's
// `written_at` by more than this many minutes.
const PROVIDER_STALE_MIN = 10;

/** Minutes the provider source lags `written_at`; `null` when unknowable. */
function sourceLag(
  writtenAt: number | null,
  sourceTs: number | null | undefined,
): number | null {
  if (writtenAt === null || sourceTs === null || sourceTs === undefined)
    return null;
  return (writtenAt - sourceTs) / 60;
}

// ── View-model shapes ──────────────────────────────────────────────────────
interface BarView {
  label: string;
  /** What is left, which is the number the halt threshold is written in. */
  remaining: number;
  color: string;
  status: RemainingStatus;
  reset: string | null;
  /** The window's reset has passed (or it has none): the captured % belongs to a
   *  window that already rolled over, so there is no current figure — render a
   *  hatched track and say so, rather than a bar at 0% or 100%. */
  unknown: boolean;
  /** Present only for the window the loop's halt threshold applies to. */
  haltMarker: string | null;
  note: string | null;
}
interface QuotaSection {
  kind: 'quota';
  name: string;
  stale: boolean;
  staleTitle?: string;
  /** Which file, and which block of it, this group was read from. */
  source: string;
  bars: BarView[];
}
interface AgySection {
  kind: 'agy';
  stale: boolean;
  staleTitle?: string;
  source: string;
  cost: string | null;
  activity: string | null;
}
type Section = QuotaSection | AgySection;

interface Card {
  name: string;
  mode: BudgetMode;
  modeLabel: string;
  planBadges: string[];
  /** One pill per reading. Never merged into a single "last seen". */
  pills: SourcePill[];
  /** Set when the two readings contradict each other. */
  conflict: Disagreement | null;
  ledgerCost: string | null;
  sections: Section[];
}

// ── Pure helpers ─────────────────────────────────────────────────────────────
function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  const unknown = isWindowUnknown(b.resets_at);
  const remaining = remainingPct(b.used_pct);
  const status = remainingStatus(remaining);
  return {
    label: b.label,
    remaining,
    color: remainingColor(status),
    status,
    reset: unknown ? null : resetLabel(b.resets_at),
    unknown,
    haltMarker: isFiveHourWindow(b.label) ? HALT_MARKER_LABEL : null,
    note: unknown ? unknownNote(b) : null,
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

/**
 * Where a provider group came from, said out loud.
 *
 * The `stale`/`live` tag next to it is a judgement about an age; without the
 * file and the block it was read from, a reader has no way to check that
 * judgement against anything.
 */
function sectionSource(
  block: string,
  sourceTs: number | null | undefined,
  file: string | null,
): string {
  const where = file
    ? `${file} › ${block}`
    : `${block} block of the quota snapshot`;
  return sourceTs
    ? `${where} · captured ${relative(sourceTs)}`
    : `${where} · capture time not reported`;
}

function planBadges(b: MachineBudget | null): string[] {
  const plans = new Set<string>();
  if (b?.claude?.plan) plans.add(b.claude.plan);
  if (b?.codex?.plan) plans.add(b.codex.plan);
  return [...plans].map(titleCase);
}

function buildSections(
  b: MachineBudget | null,
  file: string | null,
): Section[] {
  if (!b) return [];
  const w = b.written_at;
  const sections: Section[] = [];

  if (b.claude) {
    sections.push({
      kind: 'quota',
      name: 'Claude',
      ...staleInfo(w, b.claude.source_ts),
      source: sectionSource('claude', b.claude.source_ts, file),
      bars: b.claude.bars.map(toBar),
    });
  }
  if (b.codex) {
    sections.push({
      kind: 'quota',
      name: 'Codex',
      ...staleInfo(w, b.codex.source_ts),
      source: sectionSource('codex', b.codex.source_ts, file),
      bars: b.codex.bars.map(toBar),
    });
  }
  if (b.agy) {
    const a = b.agy;
    sections.push({
      kind: 'agy',
      ...staleInfo(w, a.source_ts),
      source: sectionSource('agy', a.source_ts, file),
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
  // Reference `now` so relative labels (ages / resets) recompute on tick.
  void now.value;

  // A machine known only to the enrollment API still gets a card: a host that
  // one reader knows about and the other does not is exactly the state this
  // panel exists to show.
  const names = new Set<string>([
    ...Object.keys(props.budgets),
    ...props.byMachine.map((m) => m.key),
    ...Object.keys(props.readings ?? {}),
  ]);

  return [...names].sort().map((name) => {
    const budget = props.budgets[name] ?? null;
    const ledger = props.byMachine.find((m) => m.key === name) ?? null;
    const mode = props.modes[name] ?? 'dark';
    const reading = props.readings?.[name] ?? null;
    const modeLabel =
      mode !== 'dark'
        ? MODE_META[mode].label
        : budget?.claude
          ? 'stale'
          : 'no quota';

    return {
      name,
      mode,
      modeLabel,
      planBadges: planBadges(budget),
      pills: readingPills(reading),
      conflict: disagreement(reading),
      ledgerCost: ledger ? formatUsd(ledger.cost) : null,
      sections: buildSections(budget, reading?.telemetry?.source ?? null),
    };
  });
});
</script>

<template>
  <section>
    <div class="mb-3 flex items-center gap-2">
      <MonitorSmartphone class="text-muted-foreground size-4" />
      <h2 class="text-foreground text-lg font-semibold tracking-tight">
        Machines
      </h2>
      <span class="text-muted-foreground text-sm"
        >{{ cards.length }} reporting</span
      >
    </div>

    <p class="text-muted-foreground mb-4 max-w-prose text-xs">
      Every machine is read twice, from two files on two clocks. Where the two
      disagree, this panel says so instead of choosing.
    </p>

    <div
      v-if="cards.length === 0"
      class="text-muted-foreground border-border flex items-center gap-2 rounded-md border border-dashed px-4 py-8 text-sm"
    >
      <CalendarClock class="size-4" />
      No machines reporting yet — run the quota reader to populate
      <code class="text-foreground"
        >_system/usage/quota.&lt;machine&gt;.json</code
      >.
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

              <!-- Both readings, each naming its own file and its own age.
                   Never collapsed into one "last seen": that collapse is the
                   arbitration this panel is not allowed to make. -->
              <div v-if="card.pills.length" class="mt-1.5 flex flex-wrap gap-1">
                <span
                  v-for="p in card.pills"
                  :key="p.kind"
                  class="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[11px]"
                  :style="p.expired ? STALE_TAG_STYLE : undefined"
                  :title="`read from ${p.source}`"
                >
                  {{ p.text }}
                </span>
              </div>
              <p v-else class="text-muted-foreground mt-1.5 text-xs">
                No reading from either source.
              </p>
            </div>
            <div
              class="flex shrink-0 flex-wrap items-center justify-end gap-1.5"
            >
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
          <!-- The two sources contradict each other. Both statements are
               reported; neither is promoted to the answer. -->
          <div
            v-if="card.conflict"
            class="mb-4 rounded-md border p-3 text-xs"
            :style="CONFLICT_BOX_STYLE"
          >
            <p class="text-foreground flex items-center gap-1.5 font-semibold">
              <Split class="size-3.5" /> Sources disagree
            </p>
            <dl class="mt-2 space-y-1">
              <div class="flex gap-2">
                <dt class="text-muted-foreground shrink-0 font-medium">
                  snapshot says
                </dt>
                <dd class="text-foreground">
                  {{ card.conflict.snapshotSays }}
                </dd>
              </div>
              <div class="flex gap-2">
                <dt class="text-muted-foreground shrink-0 font-medium">
                  enrollment says
                </dt>
                <dd class="text-foreground">
                  {{ card.conflict.enrollmentSays }}
                </dd>
              </div>
            </dl>
            <p class="text-muted-foreground mt-2">{{ card.conflict.why }}</p>
          </div>

          <template v-if="card.sections.length">
            <div
              v-for="(section, i) in card.sections"
              :key="section.kind + i"
              :class="i > 0 ? 'border-border mt-4 border-t pt-4' : ''"
            >
              <!-- Provider group header: name, stale/live tag, and the source
                   that tag is a judgement about. -->
              <div class="mb-1 flex items-center gap-2">
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
                  class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  :style="section.stale ? STALE_TAG_STYLE : LIVE_TAG_STYLE"
                  :title="section.staleTitle"
                >
                  {{ section.stale ? 'stale' : 'live' }}
                </span>
              </div>
              <p class="text-muted-foreground mb-2 truncate text-[11px]">
                {{ section.source }}
              </p>

              <!-- Quota bars, drawn as headroom: the fill is what is left. -->
              <div v-if="section.kind === 'quota'" class="space-y-2.5">
                <div
                  v-for="bar in section.bars"
                  :key="bar.label"
                  class="space-y-1"
                >
                  <div
                    class="flex items-baseline justify-between gap-2 text-xs"
                  >
                    <span class="text-foreground truncate">{{
                      bar.label
                    }}</span>
                    <span
                      v-if="bar.unknown"
                      class="shrink-0 italic"
                      :style="{ color: 'var(--status-warning)' }"
                    >
                      {{ bar.note }}
                    </span>
                    <span
                      v-else
                      class="text-muted-foreground shrink-0 tabular-nums"
                    >
                      {{ formatPct(bar.remaining) }} left<template
                        v-if="bar.reset"
                      >
                        · {{ bar.reset }}</template
                      >
                    </span>
                  </div>
                  <div
                    class="relative h-2 w-full overflow-hidden rounded-full border"
                    :class="
                      bar.unknown
                        ? 'border-dashed'
                        : 'bg-muted border-transparent'
                    "
                    :style="bar.unknown ? UNKNOWN_TRACK_STYLE : undefined"
                    role="img"
                    :aria-label="
                      bar.unknown
                        ? `${bar.label}: ${bar.note}`
                        : `${bar.label}: ${formatPct(bar.remaining)} left, ${bar.status}`
                    "
                  >
                    <div
                      v-if="!bar.unknown"
                      class="h-full rounded-full"
                      :style="{
                        width: bar.remaining + '%',
                        backgroundColor: bar.color,
                      }"
                    />
                    <!-- The line the loop actually stops at, drawn on the
                         window it applies to so the threshold is visible next
                         to the value rather than remembered. -->
                    <span
                      v-if="bar.haltMarker"
                      class="absolute inset-y-0 w-px"
                      :style="{
                        left: HALT_AT_PCT + '%',
                        backgroundColor: 'var(--foreground)',
                      }"
                      aria-hidden="true"
                    />
                  </div>
                  <p
                    v-if="bar.haltMarker"
                    class="text-muted-foreground text-[10px]"
                    :style="{ marginInlineStart: HALT_AT_PCT + '%' }"
                  >
                    │ {{ bar.haltMarker }}
                  </p>
                </div>
              </div>

              <!-- agy estimated block (no quota bar) -->
              <div v-else>
                <div class="flex items-baseline justify-between gap-2">
                  <span
                    class="text-foreground text-lg font-semibold tabular-nums"
                  >
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
            <p class="text-muted-foreground text-xs">
              Est. cost (this machine)
            </p>
            <p class="text-foreground font-semibold tabular-nums">
              {{ card.ledgerCost }}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
