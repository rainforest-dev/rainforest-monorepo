/**
 * The phone-sized greenlight screen, derived rather than drawn.
 *
 * Everything here is pure and free of `node:` imports: `MobileDecide.vue` is a
 * client-hydrated island, so anything it imports for a runtime value ends up in
 * the browser bundle. `api/decide.ts` does the reading; this file only turns
 * what was read into the sentences the screen is allowed to say.
 *
 * Two rules run through all of it, both from the canvas this was built from:
 *
 * 1. An absent figure is drawn as absent. A quota window with no number is a
 *    dashed empty track that says "not reported", never a full bar and never a
 *    zero one -- both of those are confident readings, and the whole reason the
 *    screen exists is that a confident reading of a missing value is what sent
 *    a run at a machine that had stopped answering.
 * 2. Clearing is deliberate. There are no swipes anywhere in this module's
 *    vocabulary; the only way to authorise a task is to hold a button down, and
 *    the literal line that hold will write is on screen before it starts.
 */
import type { OutboxState } from './greenlightOutbox.js';
import {
  HALT_AT_PCT,
  isFiveHourWindow,
  isWindowUnknown,
  remainingPct,
  type RemainingStatus,
  remainingStatus,
  unknownNote,
} from './machineReadings.js';

// -- Touch geometry ----------------------------------------------------------

/**
 * The two sizes every interactive element on this screen is measured against.
 *
 * Constants rather than literals in a class string because the acceptance
 * criterion is a number a test can hold: a control that shrinks below these is
 * a regression, not a style tweak.
 */
export const TOUCH_MIN_PX = 44;
export const PRIMARY_MIN_PX = 48;
/** The hold target is the one control a mis-tap actually costs something. */
export const HOLD_MIN_PX = 52;

// -- Hold-to-clear -----------------------------------------------------------

export const HOLD_DEFAULT_MS = 1000;
export const HOLD_MIN_MS = 400;
export const HOLD_MAX_MS = 2500;
/** Vibration on completion, in ms. The canvas's number, kept literally. */
export const HOLD_VIBRATE_MS = 18;

/**
 * Clamp a requested hold duration into the range the design allows.
 *
 * Anything unparseable falls back to the default rather than to zero: a hold of
 * 0 ms is a tap, and a tap is the exact interaction this screen refuses.
 */
export function holdMs(requested: unknown): number {
  const n =
    typeof requested === 'number'
      ? requested
      : typeof requested === 'string'
        ? Number.parseFloat(requested)
        : Number.NaN;
  if (!Number.isFinite(n)) return HOLD_DEFAULT_MS;
  return Math.min(HOLD_MAX_MS, Math.max(HOLD_MIN_MS, Math.round(n)));
}

export function holdHint(ms: number, holding: boolean): string {
  if (holding) return 'release to cancel';
  return `press and hold ${(ms / 1000).toFixed(1)}s to write the id`;
}

// -- Quota, always two rows --------------------------------------------------

export type QuotaRowState = 'known' | 'unknown';

/** One quota bar, including the ones there is no number for. */
export interface QuotaRow {
  label: string;
  /** Percentage left, or `null` when nothing usable was reported. */
  leftPct: number | null;
  /** CSS width for the filled part. `0%` when unknown -- see `state`. */
  width: string;
  status: RemainingStatus;
  state: QuotaRowState;
  /** Why the track is empty, or when the window resets. Always present. */
  note: string;
}

/** Just enough of a `QuotaBar` to read; keeps `budget.ts` (and `node:fs`) out. */
export interface BarLike {
  label: string;
  used_pct: number;
  resets_at: number | null;
}

/**
 * A quota row for a window that may not have been reported at all.
 *
 * `bar` is nullable on purpose. `budget.ts` only emits a bar for a bucket that
 * parsed, so a machine reporting `"weekly_all": null` -- which is what
 * `quota.rainforest-mini.json` holds today -- produces no bar and would simply
 * vanish from a list built by mapping over `bars`. A window that dropped off
 * the screen reads as a window that does not exist, so the row is built from
 * the label the screen wants, not from the data that happened to arrive.
 */
export function quotaRow(
  label: string,
  bar: BarLike | null,
  now: number = Date.now(),
): QuotaRow {
  if (!bar) {
    return {
      label,
      leftPct: null,
      width: '0%',
      status: 'warn',
      state: 'unknown',
      note: 'not reported — unknown, not zero',
    };
  }
  if (isWindowUnknown(bar.resets_at, now)) {
    return {
      label,
      leftPct: null,
      width: '0%',
      status: 'warn',
      state: 'unknown',
      note: unknownNote(bar, now),
    };
  }
  const left = remainingPct(bar.used_pct);
  const status = remainingStatus(left);
  return {
    label,
    leftPct: left,
    width: `${left.toFixed(1)}%`,
    status,
    state: 'known',
    note:
      status === 'bad'
        ? `at or below the ${HALT_AT_PCT}% line — the loop stops itself here`
        : `resets ${resetLabel(bar.resets_at, now)}`,
  };
}

/** `left`, spelled the way the bar's own label reads. */
export function quotaValueLabel(row: QuotaRow): string {
  return row.state === 'unknown' ? 'not reported' : `${row.leftPct}% left`;
}

/**
 * How far off a reset is, in words.
 *
 * A date would make the reader subtract; this screen is read one-handed while
 * deciding whether there is room for one more run, and "in 2 h 41 m" is the
 * form that answers that question without arithmetic.
 */
export function resetLabel(
  resets_at: number | null,
  now: number = Date.now(),
): string {
  if (!resets_at) return 'at an unreported time';
  const ms = resets_at * 1000 - now;
  if (ms <= 0) return 'now';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins} m`;
  return `in ${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} m`;
}

/** The one account block per machine, with both windows always present. */
export interface QuotaAccount {
  host: string;
  /** What the host is declared to run, or the fact that nothing declares it. */
  scope: string;
  rows: QuotaRow[];
}

/** Minimal shape of a machine's Claude snapshot. */
export interface ClaudeLike {
  bars: BarLike[];
}

/**
 * Both windows for one machine, in the order the halt threshold matters.
 *
 * The 5-hour row leads because it is the one the loop stops against; the weekly
 * row is second and is rendered even when the machine has never reported it,
 * which is the case this screen was written for.
 */
export function quotaAccount(
  host: string,
  scope: string,
  claude: ClaudeLike | null,
  now: number = Date.now(),
): QuotaAccount {
  const bars = claude?.bars ?? [];
  const five = bars.find((b) => isFiveHourWindow(b.label)) ?? null;
  const weekly = bars.find((b) => b.label.toLowerCase().startsWith('weekly'));
  return {
    host,
    scope,
    rows: [
      quotaRow('5-hour window', five, now),
      quotaRow('weekly', weekly ?? null, now),
    ],
  };
}

// -- Cards -------------------------------------------------------------------

export type DecideScope = 'company' | 'personal';
/** Undecided, authorised, or deliberately parked. The canvas's three states. */
export type CardState = 'pending' | 'cleared' | 'held';

export interface DecideCard {
  id: string;
  scope: DecideScope;
  /** The machine that would execute it, never the machine showing the screen. */
  host: string;
  title: string;
  meta: string;
  state: CardState;
  /** What `cleared` means here, in the outbox's own words. */
  stateNote: string;
  project: string | null;
  scopeNote: string;
  writeLine: string;
  hostStateLine: string;
  hostStateStatus: RemainingStatus;
  quotaLine: string;
  quotaStatus: RemainingStatus;
  greenlightLine: string;
  caution: string | null;
}

/** Just the task fields a card reads. */
export interface TaskLike {
  id: number | string | null;
  name: string;
  scope: 'work' | 'personal';
  status: string;
  loopStatus?: string | null;
  priority: string | null;
  points: number | null;
  component: string | null;
}

/** `P1 · 3 pts · cloud-frontend · PR ready`, with the gaps named. */
export function cardMeta(task: TaskLike): string {
  return [
    task.priority ?? 'no priority',
    task.points == null ? 'unpointed' : `${task.points} pts`,
    task.component ?? 'no component',
    task.loopStatus ?? task.status,
  ].join(' · ');
}

/**
 * The state a card is in, from the decision path's own answers.
 *
 * `greenlit` leads: on the remote path it is the ack from the executor, which
 * is the only thing that can say the authorisation actually landed. A recorded
 * `plan-first` is a hold; everything else is still owed a decision.
 */
export function cardState(input: {
  greenlit: boolean;
  outboxState: OutboxState;
  existingDecision: 'greenlight' | 'plan-first' | null;
}): CardState {
  if (input.greenlit || input.outboxState === 'pending') return 'cleared';
  if (input.existingDecision === 'plan-first') return 'held';
  return 'pending';
}

/**
 * What `cleared` means for this card, which is not the same sentence on both
 * delivery paths.
 *
 * A queued request is not an authorisation yet -- it is a file waiting for the
 * executor to read it -- and saying "cleared" without saying so would promise
 * something no ack has confirmed.
 */
export function stateNote(state: CardState, outboxState: OutboxState): string {
  if (state === 'held') return 'held · not in the greenlight list';
  if (state !== 'cleared') return '';
  switch (outboxState) {
    case 'pending':
      return 'queued · request written, no ack from the executor yet';
    case 'applied':
      return 'cleared · id applied to the executor’s greenlight list';
    case 'duplicate':
      return 'cleared · id was already on the executor’s greenlight list';
    default:
      return 'cleared · id written to the greenlight list';
  }
}

/**
 * The literal thing the hold will write, path first.
 *
 * Not a paraphrase. The criterion this satisfies is that nobody authorises a
 * run without having seen the bytes it appends, and a summary of a write is
 * exactly the thing that lets a wrong path go unnoticed.
 */
export function writeLine(input: {
  deliveryMode: 'local' | 'remote-queue' | 'none';
  path: string;
  line: string;
  executor: string | null;
}): string {
  if (input.deliveryMode === 'none') {
    return 'nothing — no executor is configured for this task';
  }
  if (input.deliveryMode === 'remote-queue') {
    return [
      input.path,
      `+ ${input.line}`,
      '',
      `${input.executor ?? 'the remote executor'} appends it to its own greenlight list on its next pull.`,
    ].join('\n');
  }
  return [input.path, `+ ${input.line}`].join('\n');
}

/**
 * When clearing is worth a second look, and why.
 *
 * Two conditions, both from the canvas. A stale host is the sharper one: the
 * write still succeeds, and nothing on this screen can tell whether anything is
 * still reading the file it lands in. The points condition is a heuristic and
 * deliberately worded as one -- it says the run will likely be cut off, not
 * that it will fail.
 *
 * `POINTS_PER_PCT` is the tunable: how much of a 5-hour window one story point
 * is assumed to cost. It is a guess calibrated against nothing but observed
 * runs, which is why the sentence it produces hedges.
 */
export const POINTS_PER_PCT = 10;

export function cautionFor(input: {
  hostStale: boolean;
  host: string;
  points: number | null;
  windowLeftPct: number | null;
}): string | null {
  if (input.hostStale) {
    return `${input.host} is stale. Clearing writes the id now, but nothing here can confirm the executor is still reading the file.`;
  }
  if (input.windowLeftPct === null) {
    return `${input.host} has not reported a 5-hour figure, so there is no way to tell from here whether there is room for this run.`;
  }
  if (
    input.points != null &&
    input.points * POINTS_PER_PCT > input.windowLeftPct
  ) {
    return `${input.points} points against ${input.windowLeftPct}% of the window. It will likely be cut off by the window reset rather than finish.`;
  }
  return null;
}

// -- Running now -------------------------------------------------------------

export interface RunningRun {
  id: string;
  scope: DecideScope;
  host: string;
  title: string;
  meta: string;
  /** Unix ms the run started, or `null` when the row carries no usable time. */
  startedAtMs: number | null;
}

/**
 * `hh:mm:ss` since the run started, or the fact that the row has no start time.
 *
 * A run with an unreadable `started_at` shows `--:--:--`, not `00:00:00`: a
 * clock reading zero says the run began this second, which is a claim, and the
 * row cannot support it.
 */
export function elapsedLabel(
  startedAtMs: number | null,
  now: number = Date.now(),
): string {
  if (startedAtMs === null || !Number.isFinite(startedAtMs)) return '--:--:--';
  const secs = Math.max(0, Math.floor((now - startedAtMs) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    pad(Math.floor(secs / 3600)),
    pad(Math.floor((secs % 3600) / 60)),
    pad(secs % 60),
  ].join(':');
}

// -- Hosts -------------------------------------------------------------------

export type HostState = 'ok' | 'stale' | 'unknown';

export interface DecideHost {
  name: string;
  state: HostState;
  /** Declared scope, or the fact that nothing declares it. */
  scope: string;
  /** Age of the newest reading, or why there is no age. */
  report: string;
  reportStatus: RemainingStatus;
  /** How many ids this host's greenlight list currently carries. */
  greenlight: string;
  note: string;
}

/** Two hourly cycles: one missed run is a hiccup, two is a machine that stopped. */
export const HOST_STALE_MS = 2 * 60 * 60 * 1000;

/**
 * Whether a host's freshest reading is recent enough to act on.
 *
 * `unknown` is a third state and not a synonym for `stale`: a host that has
 * never reported has told us nothing, and calling that "stale" implies it used
 * to be fine.
 */
export function hostState(
  newestAgeMs: number | null,
  now: number = HOST_STALE_MS,
): HostState {
  if (newestAgeMs === null) return 'unknown';
  return newestAgeMs <= now ? 'ok' : 'stale';
}

/** `1 id cleared` / `no ids cleared`, counted rather than implied. */
export function greenlightLabel(count: number | null): string {
  if (count === null) return 'not readable from here';
  if (count === 0) return 'no ids cleared';
  return `${count} id${count === 1 ? '' : 's'} cleared`;
}

/** The header pill: how many of the listed hosts are not answering. */
export function staleSummary(hosts: DecideHost[]): string {
  const stale = hosts.filter((h) => h.state !== 'ok').length;
  if (hosts.length === 0) return 'no hosts reported';
  return stale === 0 ? 'all hosts ok' : `${stale} of ${hosts.length} stale`;
}

/** `3 undecided` / `all decided`, so the heading carries the count. */
export function waitingSummary(cards: DecideCard[]): string {
  const pending = cards.filter((c) => c.state === 'pending').length;
  return pending === 0 ? 'all decided' : `${pending} undecided`;
}

/** The whole payload `/api/decide` returns. */
export interface DecideView {
  cards: DecideCard[];
  quotas: QuotaAccount[];
  running: RunningRun[];
  hosts: DecideHost[];
  /** Wall clock the server derived the ages from, so the client can drift-check. */
  now: number;
}
