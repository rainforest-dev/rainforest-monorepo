import type { HostRecord } from './store.js';

export interface Drift {
  kind: 'stale' | 'role-unsatisfied' | 'account-mismatch';
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
  if (!d) return out;

  if (d.roles.includes('telemetry-sink') && !f.otlpListening) {
    out.push({
      kind: 'role-unsatisfied',
      detail:
        'telemetry-sink declared, but nothing is listening on 4318 — ralph exports into a closed socket and the OTel SDK does not complain',
    });
  }
  if (
    d.scope === 'work' &&
    f.accounts.ghLogin &&
    !f.accounts.ghLogin.endsWith('-angible')
  ) {
    out.push({
      kind: 'account-mismatch',
      detail: `work machine resolved gh to ${f.accounts.ghLogin}`,
    });
  }
  return out;
}
