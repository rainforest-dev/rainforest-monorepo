/**
 * What a machine card is allowed to say, and what it must refuse to decide.
 *
 * Every machine on this page is read twice, from two files written by two
 * different things on two different clocks: `hosts.json`, which `enroll.sh`
 * writes once when a person runs it, and `quota.<host>.json`, which the hourly
 * usage job writes unattended. Nothing re-sends the first, so it goes stale
 * fifteen minutes after enrolment and stays there while the second keeps
 * arriving. On 2026-08-29 those two files, for one machine, supported opposite
 * conclusions -- and Overview showed a single "Last seen", which meant it had
 * silently picked one.
 *
 * The helpers here exist so the card can show both readings, each labelled with
 * the file it came from, and state the disagreement instead of arbitrating it.
 *
 * Deliberately free of `node:` imports: `MachinesPanel.vue` is a client-hydrated
 * island, so anything it imports for its runtime values ends up in the browser
 * bundle. `humanAge`/`STALE_AFTER_MS` come from `enroll/drift.ts`, whose only
 * import is type-only and therefore erased.
 */
import type { QuotaBar } from './budget.js';
import { humanAge, STALE_AFTER_MS } from './enroll/drift.js';

/** One age, named by the file it was read from. */
export interface Reading {
  ageMs: number;
  source: string;
}

/** The `readings` block `/api/enroll/hosts` returns per host. */
export interface HostReadings {
  enrollment: Reading | null;
  telemetry: Reading | null;
  conflict: string | null;
}

// -- Quota, read as what is left ---------------------------------------------

/**
 * The percentage the loop halts at, and the reason the 5-hour bar carries a
 * line rather than just a number: the threshold is a fact about the system, and
 * a reader should not have to remember it to know whether a bar is near it.
 */
export const HALT_AT_PCT = 10;
/** Below this much left, the window is worth watching but is not halting. */
export const WARN_AT_PCT = 25;

export type RemainingStatus = 'ok' | 'warn' | 'bad';

/**
 * Providers report consumption; the page reports headroom.
 *
 * These are the same number, but not the same sentence. "94% used" and "6%
 * left" both describe a machine about to stop, and only the second one says so
 * in the units the halt threshold is written in.
 */
export function remainingPct(usedPct: number): number {
  if (!Number.isFinite(usedPct)) return 0;
  return Math.min(100, Math.max(0, 100 - usedPct));
}

/** Low is bad. The number is what is left, so the scale runs the other way. */
export function remainingStatus(remaining: number): RemainingStatus {
  if (remaining <= HALT_AT_PCT) return 'bad';
  if (remaining <= WARN_AT_PCT) return 'warn';
  return 'ok';
}

export function remainingColor(status: RemainingStatus): string {
  if (status === 'bad') return 'var(--status-critical)';
  if (status === 'warn') return 'var(--status-warning)';
  return 'var(--status-good)';
}

/** The 5-hour window is the one the halt threshold is defined against. */
export function isFiveHourWindow(label: string): boolean {
  return label.toLowerCase().includes('5-hour');
}

export const HALT_MARKER_LABEL = `loop halts at ${HALT_AT_PCT}% left`;

/**
 * A window whose reset has passed reports a number from a window that no longer
 * exists. That is not zero and it is not full -- it is absent, and the bar has
 * to look like neither of the two confident readings it could be mistaken for.
 */
export function isWindowUnknown(
  resets_at: number | null,
  now: number = Date.now(),
): boolean {
  return !resets_at || resets_at * 1000 <= now;
}

/**
 * Says when the figure stopped being current, and then says the thing the shape
 * of an empty bar would otherwise imply.
 */
export function unknownNote(
  bar: Pick<QuotaBar, 'resets_at'>,
  now: number = Date.now(),
): string {
  if (!bar.resets_at) return 'no figure reported — unknown, not zero';
  const since = humanAge(Math.max(0, now - bar.resets_at * 1000));
  return `no figure since ${since} ago — unknown, not zero`;
}

// -- The two readings --------------------------------------------------------

export interface SourcePill {
  /** Which reader this is, in the reader's words rather than the file's. */
  kind: 'telemetry' | 'enrollment';
  /** Human name, e.g. `quota snapshot`. */
  name: string;
  /** The file, named so an age can be traced back to something on disk. */
  source: string;
  age: string;
  /** The enrollment report is past its window and nothing will re-send it. */
  expired: boolean;
  text: string;
}

function pill(
  kind: SourcePill['kind'],
  name: string,
  reading: Reading,
  expired: boolean,
): SourcePill {
  const age = humanAge(reading.ageMs);
  return {
    kind,
    name,
    source: reading.source,
    age,
    expired,
    text: expired ? `${name} · ${age} old · expired` : `${name} · ${age} old`,
  };
}

/**
 * Both readings, never merged.
 *
 * A machine missing one of them shows one pill; it does not fall back to the
 * other and relabel it, because "we have one reading" and "we have two that
 * agree" are different states and only one of them is corroboration.
 */
export function readingPills(readings: HostReadings | null): SourcePill[] {
  if (!readings) return [];
  const out: SourcePill[] = [];
  if (readings.telemetry) {
    out.push(pill('telemetry', 'quota snapshot', readings.telemetry, false));
  }
  if (readings.enrollment) {
    out.push(
      pill(
        'enrollment',
        'enrollment report',
        readings.enrollment,
        readings.enrollment.ageMs > STALE_AFTER_MS,
      ),
    );
  }
  return out;
}

export interface Disagreement {
  snapshotSays: string;
  enrollmentSays: string;
  /** The server's sentence on why both statements hold. Not re-derived here. */
  why: string;
}

/**
 * The two claims, side by side, and the server's reconciliation of them.
 *
 * There is no third field for "and therefore the machine is X". The page states
 * the split; the reader resolves it, or does not, which is the honest outcome
 * when the two sources genuinely measure different things.
 */
export function disagreement(
  readings: HostReadings | null,
): Disagreement | null {
  if (!readings?.conflict) return null;
  const t = readings.telemetry;
  const e = readings.enrollment;
  return {
    snapshotSays: t
      ? `running — ${t.source} written ${humanAge(t.ageMs)} ago`
      : 'nothing — no quota snapshot for this machine',
    enrollmentSays: e
      ? `unverified — ${e.source} is ${humanAge(e.ageMs)} old`
      : 'unverified — this machine has never enrolled',
    why: readings.conflict,
  };
}
