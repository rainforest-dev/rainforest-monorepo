import type { HostRecord } from './store.js';

export interface Drift {
  kind:
    | 'stale'
    | 'role-unsatisfied'
    | 'account-mismatch'
    | 'not-declared'
    /**
     * The account check could not be run, as distinct from running and
     * disagreeing. `account-mismatch` says "this machine is signed into the
     * wrong account"; this says "this machine did not tell us which account,
     * so nothing checked". Collapsing the two was a live bug in both
     * directions -- see the block that raises it.
     */
    | 'account-unverified';
  detail: string;
}

/** Three device report cycles. Beyond it the host reads stale, not last-known-good. */
export const STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * What a host declares against what it reports.
 *
 * This is the reader every failure on 2026-08-26 lacked: in each one a writer
 * succeeded and nothing checked the result.
 */
export function driftFor(record: HostRecord, now: number): Drift[] {
  const out: Drift[] = [];
  const { declaration: d, facts: f, reportedAt } = record;

  if (!f || reportedAt === null || now - reportedAt > STALE_AFTER_MS) {
    out.push({
      kind: 'stale',
      detail:
        reportedAt === null
          ? 'never reported'
          : `last reported ${now - reportedAt}ms ago`,
    });
    return out;
  }
  // A host with facts and no declaration is not a healthy host; it is a host
  // nothing can be said about. Returning an empty list here used to make the
  // setup page print "matches its declaration" in green for a machine that had
  // no declaration to match and for which zero files could be derived -- the
  // same shape as every failure this design exists to remove, reproduced by the
  // reader itself.
  if (!d) {
    out.push({
      kind: 'not-declared',
      detail:
        'reported facts, but no declaration exists for this host — nothing can be derived for it until one does. Add it under `hosts:` in tools/loop/hosts.yaml',
    });
    return out;
  }

  if (d.roles.includes('telemetry-sink') && !f.otlpListening) {
    out.push({
      kind: 'role-unsatisfied',
      detail:
        'telemetry-sink declared, but nothing is listening on 4318 — ralph exports into a closed socket and the OTel SDK does not complain',
    });
  }
  if (d.roles.includes('ralph') && f.executors.length === 0) {
    out.push({
      kind: 'role-unsatisfied',
      detail:
        "ralph declared, but no executors were found (facts.executors is empty) — LOOP_EXECUTORS is left unset, ralph falls back to its built-in claude,codex,agy list, finds each one unavailable in turn, logs 'all configured executors failed', and exits without ever writing a ledger record, so the run is invisible to the dashboard rather than reported as a failure",
    });
  }
  // Only `work` carries an account expectation, so only `work` can fail one.
  // Both outcomes are reported, because the two ways this check can go wrong
  // are opposite and were both live:
  //
  //  * `ghLogin` was the literal string "unknown" on a machine with no gh
  //    login at all (the probe emitted that word), and this branch reported it
  //    as `work machine resolved gh to unknown` -- an account MISMATCH raised
  //    against a machine that was simply logged out. The probe now emits an
  //    empty login, which parse.ts turns into null.
  //  * When `ghLogin` was genuinely null this whole block was silent, so a work
  //    machine whose account could not be established looked identical to one
  //    verified correct. Not knowing is not the same as being fine.
  if (d.scope === 'work') {
    const login = f.accounts.ghLogin;
    if (login === null) {
      out.push({
        kind: 'account-unverified',
        detail:
          'work machine, but gh reported no login — the check that catches a company machine signed into a personal account could not run. Run `gh auth login` on the host and re-probe',
      });
    } else if (!login.endsWith('-angible')) {
      out.push({
        kind: 'account-mismatch',
        detail: `work machine resolved gh to ${login}`,
      });
    }
  }
  return out;
}
