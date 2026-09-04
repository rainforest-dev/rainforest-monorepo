<script setup lang="ts">
/**
 * The greenlight decision.
 *
 * Was MobileDecide, and was a phone column at every width: at 1440 it drew 67
 * cards 448px wide with 496px of nothing either side, a 414px-wide button for a
 * 48px control, and a document 20.8 screens tall. It is a queue to triage, and a
 * desk should see several at once. One column below `lg`, two above, three above
 * `2xl`. Renamed because the old name had stopped being true, and a name that
 * misleads is the cheapest kind of wrong comment to leave lying around.
 *
 * Deliberately slow, at EVERY width. The task drawer clears with one tap because
 * a mis-tap at a desk is recoverable; this screen clears only on a press held for
 * a full second, shows the literal line that press will write before it starts,
 * and has no swipe gesture anywhere -- a swipe is the one gesture a phone
 * performs by accident. The hold did not become a phone affordance when the
 * layout did: clearing a task spends money without asking again, and that is a
 * property of the action, not of the screen it was pressed on.
 *
 * It is a face on the existing write path, not a second one. Everything it
 * posts goes to `/api/task-decision`, the same endpoint `TaskDetail.vue` uses.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { trackerNotice } from '@/lib/tasksHeader';

import {
  type DecideCard,
  type DecideView,
  HOLD_MIN_PX,
  HOLD_VIBRATE_MS,
  holdHint,
  holdMs as clampHoldMs,
  PRIMARY_MIN_PX,
  quotaValueLabel,
  staleSummary,
  TOUCH_MIN_PX,
  elapsedLabel,
  waitingSummary,
} from '@/lib/decide';

const view = ref<DecideView | null>(null);

/**
 * The board's own age, in the Tasks page's words.
 *
 * `trackerNotice` rather than a second sentence: one board described two ways by
 * two screens is worse than not describing it at all, and `synced_at` moves only
 * when Notion is fetched -- which needs an MCP client and so happens from a
 * session, never from the hourly job. `written_at` is always minutes old and
 * says nothing about the queue.
 */
const boardNotice = computed(() =>
  trackerNotice(
    view.value?.syncedAt,
    view.value?.writtenAt,
    new Date(now.value),
  ),
);
const loading = ref(true);
const error = ref<string | null>(null);
const busyId = ref<string | null>(null);
const actionError = ref<string | null>(null);

/** Ticks once a second so "Running now" counts up rather than freezing. */
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | undefined;

/**
 * Hold duration, overridable per-visit with `?hold=1500`.
 *
 * A query parameter rather than a setting screen: the range exists so the press
 * can be lengthened for a shaky hand or shortened while testing, and neither is
 * a preference worth a persisted store.
 */
const holdDuration = ref(clampHoldMs(undefined));

const openId = ref<string | null>(null);
const holdingId = ref<string | null>(null);
const holdPct = ref(0);
let holdTimer: ReturnType<typeof setInterval> | undefined;

const cards = computed(() => view.value?.cards ?? []);
const detail = computed<DecideCard | null>(
  () => cards.value.find((c) => c.id === openId.value) ?? null,
);
const heading = computed(() => waitingSummary(cards.value));
const hostPill = computed(() => staleSummary(view.value?.hosts ?? []));

const statusVar: Record<string, string> = {
  ok: 'var(--status-good)',
  warn: 'var(--status-warning)',
  bad: 'var(--status-critical)',
};

async function load() {
  try {
    const res = await fetch('/api/decide');
    const data = (await res.json()) as DecideView & { error?: string };
    if (!res.ok || data.error)
      throw new Error(data.error ?? `HTTP ${res.status}`);
    view.value = data;
    error.value = null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function post(id: string, decision: 'greenlight' | 'plan-first') {
  busyId.value = id;
  actionError.value = null;
  try {
    const res = await fetch(`/api/task-decision?id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision, comment: '' }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
    await load();
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : String(e);
  } finally {
    busyId.value = null;
  }
}

function startHold(id: string) {
  cancelHold();
  const started = Date.now();
  holdingId.value = id;
  holdPct.value = 0;
  holdTimer = setInterval(() => {
    const pct = Math.min(
      100,
      ((Date.now() - started) / holdDuration.value) * 100,
    );
    if (pct < 100) {
      holdPct.value = pct;
      return;
    }
    cancelHold();
    // The press is the confirmation, so the write happens here and the phone
    // says so in the one channel a pocket can feel.
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(HOLD_VIBRATE_MS);
    }
    openId.value = null;
    void post(id, 'greenlight');
  }, 24);
}

/** Releasing, leaving, or a cancelled pointer all mean the same thing: no. */
function cancelHold() {
  if (holdTimer) clearInterval(holdTimer);
  holdTimer = undefined;
  holdingId.value = null;
  holdPct.value = 0;
}

function open(id: string) {
  cancelHold();
  openId.value = id;
}

function close() {
  cancelHold();
  openId.value = null;
}

onMounted(() => {
  const requested = new URLSearchParams(window.location.search).get('hold');
  if (requested !== null) holdDuration.value = clampHoldMs(requested);
  void load();
  clock = setInterval(() => (now.value = Date.now()), 1000);
  window.addEventListener('lo:refresh', load);
});

onBeforeUnmount(() => {
  if (clock) clearInterval(clock);
  cancelHold();
  window.removeEventListener('lo:refresh', load);
});
</script>

<template>
  <!-- max-w-md is the phone column and stays one. Wider, it becomes a grid: at
       1440 this rendered 67 cards 448px wide with 496px of nothing either side,
       a 414px-wide button for a 48px control, and a document 20.8 screens tall.
       The screen is for triaging a queue; a desk should see several at once. -->
  <div class="mx-auto flex max-w-md flex-col gap-7 pb-14 lg:max-w-6xl">
    <header
      class="border-border bg-background/80 sticky top-0 z-20 -mx-1 flex items-center justify-between gap-3 border-b px-1 py-3 backdrop-blur"
    >
      <div class="flex flex-col gap-0.5">
        <span class="text-[17px] font-semibold tracking-tight">
          loop<span class="text-primary">.observatory</span>
        </span>
        <span class="text-muted-foreground font-mono text-[10px] tracking-wide">
          {{ view?.hosts.length ?? 0 }} hosts · allowlist-gated executor
        </span>
      </div>
      <span
        class="border-border text-muted-foreground flex items-center gap-2 rounded-full border px-2.5 py-1.5 font-mono text-[10px]"
      >
        <span
          class="size-1.5 rounded-full"
          :style="{
            backgroundColor:
              hostPill === 'all hosts ok'
                ? 'var(--status-good)'
                : 'var(--status-warning)',
          }"
        ></span>
        {{ hostPill }}
      </span>
    </header>

    <p v-if="loading" class="text-muted-foreground text-sm">
      Reading the vault…
    </p>
    <p
      v-else-if="error"
      class="rounded-xl border p-4 text-sm"
      :style="{
        borderColor: 'var(--status-critical)',
        color: 'var(--status-critical)',
      }"
    >
      {{ error }}
    </p>

    <template v-else>
      <!-- DECIDE ------------------------------------------------------------->
      <section class="flex flex-col gap-3">
        <div class="flex items-baseline justify-between gap-3">
          <h2
            class="m-0 text-[26px] font-semibold leading-tight tracking-tight"
          >
            Waiting for your nod
          </h2>
          <span
            class="whitespace-nowrap font-mono text-xs"
            :style="{ color: 'var(--status-warning)' }"
            >{{ heading }}</span
          >
        </div>
        <p class="text-muted-foreground m-0 text-sm leading-relaxed">
          Nothing starts until its id is in the greenlight file. Hold to clear —
          one deliberate press, no swipes.
        </p>

        <!--
          How old the board behind these cards is.
          The same sentence the Tasks page has always shown, from the same helper
          and the same file, in the same warn pill so the two screens cannot
          describe one board differently. It was missing here, and this is the
          screen where the age costs something: on 2026-09-04 it offered 67 cards
          to authorise off a board synced 21.8 hours earlier, several of them
          already merged.
        -->
        <p
          class="m-0 flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] leading-normal"
          :style="{
            color: 'var(--status-warning)',
            borderColor:
              'color-mix(in oklch, var(--status-warning) 45%, transparent)',
            backgroundColor:
              'color-mix(in oklch, var(--status-warning) 14%, transparent)',
          }"
        >
          <span
            class="inline-block size-1.5 shrink-0 rounded-full"
            :style="{ backgroundColor: 'var(--status-warning)' }"
            aria-hidden="true"
          />
          {{ boardNotice }}
        </p>

        <p
          v-if="actionError"
          class="m-0 font-mono text-[11px]"
          :style="{ color: 'var(--status-critical)' }"
        >
          {{ actionError }}
        </p>

        <p v-if="!cards.length" class="text-muted-foreground m-0 text-sm">
          No task on this board resolves to an enrolled project, so there is
          nothing here to authorise — not “nothing today”.
        </p>

        <!-- Its own container: the heading and the two notes above are siblings
             of these cards, and gridding the section would lay them out as
             cells. Two columns from lg, three from 2xl, one below. -->
        <div class="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          <article
            v-for="card in cards"
            :key="card.id"
            class="bg-card border-border flex flex-col gap-3 rounded-2xl border p-4 shadow-sm"
          >
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="font-mono text-xs">{{ card.id }}</span>
              <span
                v-if="card.scope === 'company'"
                class="border-primary/40 bg-primary/15 text-primary rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                >company</span
              >
              <span
                v-else
                class="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                >personal</span
              >
              <span
                class="border-border text-muted-foreground rounded-full border border-dashed px-2 py-0.5 font-mono text-[10px]"
                >{{ card.host }}</span
              >
            </div>

            <h3
              class="m-0 text-[17px] font-semibold leading-snug tracking-tight"
            >
              {{ card.title }}
            </h3>
            <div
              class="text-muted-foreground font-mono text-[11px] leading-relaxed"
            >
              {{ card.meta }}
            </div>

            <!-- Stacked on a phone, side by side once there is room. The hold is
               unchanged at every width: it exists because clearing a task spends
               money without asking again, and that is not a property of the
               screen it was pressed on. Only the layout is responsive. -->
            <div
              v-if="card.state === 'pending'"
              class="mt-auto flex flex-col gap-2 sm:flex-row"
            >
              <button
                type="button"
                class="border-primary text-primary rounded-xl border bg-transparent px-4 text-[15px] font-semibold sm:flex-1"
                :style="{ minHeight: `${PRIMARY_MIN_PX}px` }"
                @click="open(card.id)"
              >
                Review to clear
              </button>
              <button
                type="button"
                class="border-border text-muted-foreground rounded-xl border bg-transparent px-4 text-sm disabled:opacity-60 sm:shrink-0"
                :style="{ minHeight: `${TOUCH_MIN_PX}px` }"
                :disabled="busyId === card.id"
                @click="post(card.id, 'plan-first')"
              >
                Keep on hold
              </button>
            </div>

            <div
              v-else-if="card.state === 'cleared'"
              class="flex items-center gap-2 rounded-xl border px-3.5 font-mono text-[11px] leading-snug"
              :style="{
                minHeight: `${PRIMARY_MIN_PX}px`,
                color: 'var(--status-good)',
                borderColor: 'var(--status-good)',
                backgroundColor:
                  'color-mix(in oklch, var(--status-good) 13%, transparent)',
              }"
            >
              <span
                class="size-1.5 flex-none rounded-full"
                :style="{ backgroundColor: 'var(--status-good)' }"
              ></span>
              <span>{{ card.stateNote }}</span>
            </div>

            <div
              v-else
              class="border-border text-muted-foreground flex items-center justify-between gap-2.5 rounded-xl border border-dashed px-3.5 font-mono text-[11px]"
              :style="{ minHeight: `${PRIMARY_MIN_PX}px` }"
            >
              <span>{{ card.stateNote }}</span>
              <!--
              Not "release": the write path records a decision, it does not
              erase one, and a button that claims to un-hold would be claiming
              a mechanism that does not exist. Reviewing again is what actually
              changes the outcome.
            -->
              <button
                type="button"
                class="text-primary bg-transparent px-1 font-mono text-[11px]"
                :style="{ minHeight: `${TOUCH_MIN_PX}px` }"
                @click="open(card.id)"
              >
                review again
              </button>
            </div>
          </article>
        </div>
      </section>

      <!-- QUOTA -------------------------------------------------------------->
      <section class="flex flex-col gap-3">
        <div
          class="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.1em]"
        >
          Quota headroom
        </div>
        <p class="text-muted-foreground m-0 text-sm leading-relaxed">
          The loop stops itself when the 5-hour window runs low. Percentages are
          what is left.
        </p>

        <div
          v-for="account in view?.quotas ?? []"
          :key="account.host"
          class="bg-card border-border flex flex-col gap-3.5 rounded-2xl border p-4 shadow-sm"
        >
          <div class="flex items-baseline justify-between gap-2.5">
            <span class="text-[15px] font-semibold">{{ account.host }}</span>
            <span class="text-muted-foreground font-mono text-[10px]">{{
              account.scope
            }}</span>
          </div>

          <div
            v-for="row in account.rows"
            :key="row.label"
            class="flex flex-col gap-1.5"
          >
            <div
              class="text-muted-foreground flex items-baseline justify-between gap-2.5 font-mono text-[11px]"
            >
              <span>{{ row.label }}</span>
              <span
                class="text-[15px]"
                :style="{ color: statusVar[row.status] }"
                >{{ quotaValueLabel(row) }}</span
              >
            </div>
            <!--
              An unreported window is a dashed empty track, never a full bar and
              never a zero one. Both of those are readings; this one has none.
            -->
            <div
              class="bg-muted h-2 overflow-hidden rounded-full"
              :style="
                row.state === 'unknown'
                  ? {
                      border: '1px dashed var(--status-warning)',
                      background: 'transparent',
                    }
                  : {}
              "
            >
              <div
                v-if="row.state === 'known'"
                class="h-full rounded-full"
                :style="{
                  width: row.width,
                  backgroundColor: statusVar[row.status],
                }"
              ></div>
            </div>
            <div
              class="font-mono text-[10px]"
              :style="{
                color:
                  row.state === 'unknown'
                    ? 'var(--status-warning)'
                    : 'var(--muted-foreground)',
              }"
            >
              {{ row.note }}
            </div>
          </div>
        </div>
      </section>

      <!-- RUNNING ------------------------------------------------------------>
      <section class="flex flex-col gap-3">
        <div
          class="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.1em]"
        >
          Running now
        </div>
        <p
          v-if="!view?.running.length"
          class="text-muted-foreground m-0 text-sm"
        >
          No run is open on any machine right now.
        </p>
        <div
          v-for="run in view?.running ?? []"
          :key="run.id"
          class="bg-card border-border flex flex-col gap-2.5 rounded-2xl border p-4 shadow-sm"
        >
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              class="lo-pulse size-[7px] flex-none rounded-full"
              :style="{ backgroundColor: 'var(--status-good)' }"
            ></span>
            <span class="font-mono text-xs">{{ run.id }}</span>
            <span
              v-if="run.scope === 'company'"
              class="border-primary/40 bg-primary/15 text-primary rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
              >company</span
            >
            <span
              v-else
              class="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
              >personal</span
            >
            <span
              class="border-border text-muted-foreground rounded-full border border-dashed px-2 py-0.5 font-mono text-[10px]"
              >{{ run.host }}</span
            >
          </div>
          <div class="text-base font-semibold leading-snug tracking-tight">
            {{ run.title }}
          </div>
          <div
            class="text-muted-foreground flex items-baseline justify-between gap-2.5 font-mono text-[11px]"
          >
            <span>{{ run.meta }}</span>
            <span class="text-foreground text-sm">{{
              elapsedLabel(run.startedAtMs, now)
            }}</span>
          </div>
        </div>
      </section>

      <!-- HOSTS -------------------------------------------------------------->
      <section class="flex flex-col gap-3">
        <div
          class="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.1em]"
        >
          Hosts
        </div>
        <div
          v-for="host in view?.hosts ?? []"
          :key="host.name"
          class="bg-card border-border flex flex-col gap-2.5 rounded-2xl border p-4 shadow-sm"
        >
          <div class="flex items-center justify-between gap-2.5">
            <span class="font-mono text-xs">{{ host.name }}</span>
            <span
              class="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest"
              :style="{
                color: statusVar[host.reportStatus],
                borderColor: statusVar[host.reportStatus],
                backgroundColor: `color-mix(in oklch, ${statusVar[host.reportStatus]} 13%, transparent)`,
              }"
            >
              <span
                class="size-1.5 rounded-full"
                :style="{ backgroundColor: statusVar[host.reportStatus] }"
              ></span>
              {{ host.state }}
            </span>
          </div>
          <div
            class="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 font-mono text-[11px] leading-relaxed"
          >
            <span>scope</span
            ><span class="text-foreground">{{ host.scope }}</span>
            <span>reported</span
            ><span :style="{ color: statusVar[host.reportStatus] }">{{
              host.report
            }}</span>
            <span>greenlight</span
            ><span class="text-foreground">{{ host.greenlight }}</span>
          </div>
          <div
            class="text-[13px] leading-relaxed"
            :style="{
              color:
                host.state === 'ok'
                  ? 'var(--muted-foreground)'
                  : 'var(--status-warning)',
            }"
          >
            {{ host.note }}
          </div>
        </div>
      </section>

      <p
        class="text-muted-foreground m-0 font-mono text-[10px] leading-relaxed"
      >
        Values shown are the last report received. A missing value reads “not
        reported”, never zero.
      </p>
    </template>

    <!-- DETAIL LAYER --------------------------------------------------------->
    <div
      v-if="detail"
      class="bg-background fixed inset-0 z-40 flex flex-col"
      role="dialog"
      aria-modal="true"
      :aria-label="`greenlight decision for ${detail.id}`"
    >
      <div
        class="border-border bg-background/80 flex items-center gap-2.5 border-b px-4 py-3 backdrop-blur"
      >
        <button
          type="button"
          class="border-border text-foreground flex items-center justify-center rounded-xl border bg-transparent font-mono text-[15px]"
          :style="{
            minHeight: `${TOUCH_MIN_PX}px`,
            minWidth: `${TOUCH_MIN_PX}px`,
          }"
          aria-label="Back"
          @click="close()"
        >
          ←
        </button>
        <div class="flex flex-col gap-0.5">
          <span class="font-mono text-xs">{{ detail.id }}</span>
          <span
            class="text-muted-foreground font-mono text-[10px] tracking-wide"
            >greenlight decision</span
          >
        </div>
      </div>

      <div class="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
        <div class="flex flex-col gap-2.5">
          <div
            class="flex items-start gap-2.5 rounded-xl border px-3.5 py-3"
            :class="
              detail.scope === 'company'
                ? 'border-primary/40 bg-primary/10'
                : 'border-border bg-muted'
            "
          >
            <span
              class="pt-0.5 font-mono text-[10px] uppercase tracking-widest"
              :class="
                detail.scope === 'company'
                  ? 'text-primary'
                  : 'text-muted-foreground'
              "
              >{{ detail.scope }}</span
            >
            <span class="text-foreground text-[13px] leading-relaxed">{{
              detail.scopeNote
            }}</span>
          </div>

          <h2
            class="mb-0 mt-1 text-[23px] font-semibold leading-snug tracking-tight"
          >
            {{ detail.title }}
          </h2>
          <div
            class="text-muted-foreground font-mono text-[11px] leading-relaxed"
          >
            {{ detail.meta }}
          </div>
        </div>

        <div
          class="bg-card border-border flex flex-col gap-2.5 rounded-2xl border p-4 shadow-sm"
        >
          <div
            class="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.1em]"
          >
            What clearing does
          </div>
          <!--
            The literal bytes, read from the same function that appends them.
            A paraphrase here is how a wrong path goes unnoticed.
          -->
          <pre
            class="bg-muted text-foreground m-0 overflow-x-auto whitespace-pre rounded-xl p-3 font-mono text-[11px] leading-relaxed"
            >{{ detail.writeLine }}</pre
          >
          <p class="text-muted-foreground m-0 text-[13px] leading-relaxed">
            The executor picks it up on its next pass and starts without asking
            again. Stopping it after that means going back to the desk.
          </p>
        </div>

        <div
          class="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-2 font-mono text-[11px] leading-relaxed"
        >
          <span>host</span
          ><span class="text-foreground">{{ detail.host }}</span>
          <span>host state</span
          ><span :style="{ color: statusVar[detail.hostStateStatus] }">{{
            detail.hostStateLine
          }}</span>
          <span>window left</span
          ><span :style="{ color: statusVar[detail.quotaStatus] }">{{
            detail.quotaLine
          }}</span>
          <span>greenlight</span
          ><span class="text-foreground break-all">{{
            detail.greenlightLine
          }}</span>
        </div>

        <div
          v-if="detail.caution"
          class="rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed"
          :style="{
            color: 'var(--status-warning)',
            borderColor: 'var(--status-warning)',
            backgroundColor:
              'color-mix(in oklch, var(--status-warning) 14%, transparent)',
          }"
        >
          {{ detail.caution }}
        </div>
      </div>

      <div
        class="border-border bg-card flex flex-col gap-2 border-t px-5 pb-6 pt-3.5"
      >
        <button
          type="button"
          class="border-primary text-primary relative touch-none select-none overflow-hidden rounded-xl border bg-transparent px-4 text-base font-semibold disabled:opacity-60"
          :style="{ minHeight: `${HOLD_MIN_PX}px` }"
          :disabled="busyId === detail.id"
          @pointerdown="startHold(detail.id)"
          @pointerup="cancelHold()"
          @pointerleave="cancelHold()"
          @pointercancel="cancelHold()"
          @contextmenu.prevent
        >
          <span
            class="bg-primary/20 absolute inset-y-0 left-0 transition-[width] duration-75 ease-linear"
            :style="{
              width: holdingId === detail.id ? `${holdPct.toFixed(1)}%` : '0%',
            }"
          ></span>
          <span class="relative flex items-center justify-center">
            {{
              holdingId === detail.id
                ? 'keep holding…'
                : 'Hold to clear for execution'
            }}
          </span>
        </button>
        <div class="flex gap-2">
          <button
            type="button"
            class="border-border text-muted-foreground flex-1 rounded-xl border bg-transparent text-sm disabled:opacity-60"
            :style="{ minHeight: `${TOUCH_MIN_PX}px` }"
            :disabled="busyId === detail.id"
            @click="post(detail.id, 'plan-first')"
          >
            Keep on hold
          </button>
          <button
            type="button"
            class="text-muted-foreground flex-1 rounded-xl border border-transparent bg-transparent text-sm"
            :style="{ minHeight: `${TOUCH_MIN_PX}px` }"
            @click="close()"
          >
            Decide later
          </button>
        </div>
        <div class="text-muted-foreground text-center font-mono text-[10px]">
          {{ holdHint(holdDuration, holdingId === detail.id) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lo-pulse {
  animation: lo-decide-pulse 2s ease-in-out infinite;
}
@keyframes lo-decide-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lo-pulse {
    animation: none;
  }
}
</style>
