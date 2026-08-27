import type { Declarations } from './declarations.js';
import { derive } from './derive.js';
import { type Drift, driftFor } from './drift.js';
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
export function buildHostViews(
  records: HostRecordMap,
  now: number,
  declarations?: Declarations | null,
): Record<string, HostView> {
  const out: Record<string, HostView> = {};
  const hosts = new Set([
    ...Object.keys(records),
    ...Object.keys(declarations?.byHost ?? {}),
  ]);

  for (const host of hosts) {
    const record = records[host] ?? EMPTY_RECORD;
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
      };
    } catch (e) {
      out[host] = {
        state: 'refused',
        detail: null,
        drift,
        files: [],
        error: (e as Error).message,
      };
    }
  }
  return out;
}
