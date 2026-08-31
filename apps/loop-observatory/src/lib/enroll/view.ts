import type { Declarations } from './declarations.js';
import { derive } from './derive.js';
import { type Drift, driftFor, humanAge, STALE_AFTER_MS } from './drift.js';
import type { HostRecord, HostRecordMap } from './store.js';
import type { DerivedFile } from './types.js';

/**
 * What the page is allowed to say about a host.
 *
 * Named states rather than "no drift and no error", which is how the page came
 * to print "matches its declaration" in green for a host that had no
 * declaration and for which zero files had been derived. Health must be
 * something a reader concluded, never something inferred from two empty arrays.
 */
export type HostState =
  /** Declared, freshly reported, derived, and every declared role satisfied. */
  | 'ok'
  /** Reported facts, but nothing declares this host, so nothing can be derived. */
  | 'not-declared'
  /** No facts, or facts older than the drift window. */
  | 'stale'
  /** Declared and fresh, but declaration and reality disagree. */
  | 'drift'
  /** Derivation refused, because it would have had to guess. */
  | 'refused';

export interface HostView {
  state: HostState;
  /** Why, for the states where "why" is not obvious from the drift list. */
  detail: string | null;
  drift: Drift[];
  files: DerivedFile[];
  error: string | null;
  /**
   * The two ages this page can show for one host, each named by the file it
   * came from. Deliberately not merged into a single "last seen": they are
   * written by different things at different rates, and on 2026-08-29 they
   * disagreed -- the hourly quota job had written minutes earlier while the
   * enrollment report was a day old. Averaging them, or preferring the fresher
   * one, would have hidden the finding.
   */
  readings: {
    /** From hosts.json, written by enroll.sh. Null when never enrolled. */
    enrollment: { ageMs: number; source: string } | null;
    /** From quota.<host>.json, written hourly. Null when absent. */
    telemetry: { ageMs: number; source: string } | null;
    /**
     * Set when the two disagree about whether this host is alive: the
     * enrollment report is past STALE_AFTER_MS while telemetry is not. The
     * page states this rather than resolving it.
     */
    conflict: string | null;
  };
}

const EMPTY_RECORD: HostRecord = {
  declaration: null,
  facts: null,
  reportedAt: null,
};

/**
 * Pair every host with its declaration, its drift and its derived files.
 *
 * The host set is the union of "has reported facts" and "is declared", so a
 * declared machine that has never reported is visible as stale rather than
 * absent -- an enrolled host silently missing from the page is the same
 * unchecked-writer shape as everything else here.
 *
 * A host whose derivation refuses shows the refusal; it does not blank the
 * page. One machine with a probe that did not run must not hide the others.
 */

/**
 * Both ages, each labelled with the file it came from, plus a note when they
 * contradict each other.
 *
 * The contradiction is the point. `hosts.json` is written once by hand and goes
 * stale in fifteen minutes; `quota.<host>.json` is written hourly by a launchd
 * job. When the second is fresh and the first is not, the host is demonstrably
 * running while its facts are unverified -- two true statements that a single
 * "last seen" would have to choose between. This returns both and says so.
 */
function readingsFor(
  record: HostRecord,
  telemetry: { at: number; source: string } | null,
  now: number,
): HostView['readings'] {
  const enrollment =
    record.reportedAt === null
      ? null
      : { ageMs: now - record.reportedAt, source: 'hosts.json' };
  const tel = telemetry
    ? { ageMs: now - telemetry.at, source: telemetry.source }
    : null;
  const enrollmentStale =
    enrollment === null || enrollment.ageMs > STALE_AFTER_MS;
  const telemetryFresh = tel !== null && tel.ageMs <= TELEMETRY_FRESH_MS;
  return {
    enrollment,
    telemetry: tel,
    conflict:
      enrollmentStale && telemetryFresh
        ? `these two disagree: ${tel.source} was written ${humanAge(tel.ageMs)} ago, so this host is running, while ${enrollment === null ? 'it has never enrolled' : `hosts.json is ${humanAge(enrollment.ageMs)} old`}. Nothing re-sends the enrollment report, so the facts below are unverified rather than wrong.`
        : null,
  };
}

/**
 * How fresh a quota snapshot has to be to count as "this host is running".
 * Two hourly cycles: one missed run is a hiccup, two is a machine that stopped.
 */
const TELEMETRY_FRESH_MS = 2 * 60 * 60 * 1000;

export function buildHostViews(
  records: HostRecordMap,
  now: number,
  declarations?: Declarations | null,
  telemetry?: Record<string, { at: number; source: string }> | null,
): Record<string, HostView> {
  const out: Record<string, HostView> = {};
  const hosts = new Set([
    ...Object.keys(records),
    ...Object.keys(declarations?.byHost ?? {}),
  ]);

  for (const host of hosts) {
    const record = records[host] ?? EMPTY_RECORD;
    const readings = readingsFor(record, telemetry?.[host] ?? null, now);
    // App state first, then the version-controlled declaration. App state is a
    // device record and hosts.yaml is the system; a host enrolled through the
    // app should not be overridden by a file it never appeared in.
    const declaration =
      record.declaration ?? declarations?.byHost[host] ?? null;
    const drift = driftFor({ ...record, declaration }, now);

    if (!declaration) {
      out[host] = {
        state: 'not-declared',
        detail:
          declarations?.problems[host] ??
          declarations?.error ??
          'no entry for this host under `hosts:` in tools/loop/hosts.yaml',
        drift,
        files: [],
        error: null,
        readings,
      };
      continue;
    }

    if (drift.some((d) => d.kind === 'stale') || !record.facts) {
      out[host] = {
        state: 'stale',
        detail: null,
        drift,
        files: [],
        error: null,
        readings,
      };
      continue;
    }

    try {
      const files = derive(declaration, record.facts);
      out[host] = {
        state: drift.length ? 'drift' : 'ok',
        detail: null,
        drift,
        files,
        error: null,
        readings,
      };
    } catch (e) {
      out[host] = {
        state: 'refused',
        detail: null,
        drift,
        files: [],
        error: (e as Error).message,
        readings,
      };
    }
  }
  return out;
}
