import type { HostFacts } from './types.js';

/** A plain hostname. The value becomes a key in a JSON file and a display label. */
const SAFE_HOST = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const TCC = new Set(['permitted', 'denied', 'unknown']);
const CLAUDE_AVAILABLE = new Set(['ok', 'missing']);

function strArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v.every((x) => typeof x === 'string') ? (v as string[]) : null;
}

/**
 * Parse a device's report.
 *
 * Accepts facts and nothing else. Submitting facts must not be able to change
 * what a host is declared to be — derivation is pure and application happens on
 * the device, so this endpoint records an observation rather than a decision.
 * Unknown keys are dropped rather than passed through, so a body carrying
 * `roles` cannot declare anything.
 */
export function parseFactsBody(
  raw: unknown,
): { host: string; facts: HostFacts } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const host = body.host;
  if (typeof host !== 'string' || !SAFE_HOST.test(host)) return null;

  const f = body.facts;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return null;
  const src = f as Record<string, unknown>;

  const executors = strArray(src.executors);
  const acc = src.accounts;
  if (
    typeof src.tccICloud !== 'string' ||
    !TCC.has(src.tccICloud) ||
    executors === null ||
    typeof src.brewPrefix !== 'string' ||
    typeof src.otlpListening !== 'boolean' ||
    (src.vaultPath !== null && typeof src.vaultPath !== 'string') ||
    !acc ||
    typeof acc !== 'object' ||
    typeof src.probedAt !== 'string'
  ) {
    return null;
  }
  const a = acc as Record<string, unknown>;

  const claudeAvailable = a.claudeAvailable;
  if (
    claudeAvailable !== undefined &&
    claudeAvailable !== null &&
    !CLAUDE_AVAILABLE.has(claudeAvailable as string)
  ) {
    return null;
  }

  // Empty means "gh reported no login", which is null -- a state drift.ts
  // reports as `account-unverified`. It is NOT a login named "" and it is not
  // the word the old probe used to emit; see probes.ts.
  const rawGhLogin = typeof a.ghLogin === 'string' ? a.ghLogin.trim() : null;
  const ghLogin = rawGhLogin === '' ? null : rawGhLogin;

  return {
    host,
    facts: {
      tccICloud: src.tccICloud as HostFacts['tccICloud'],
      executors,
      brewPrefix: src.brewPrefix,
      otlpListening: src.otlpListening,
      vaultPath: (src.vaultPath as string | null) ?? null,
      accounts: {
        claudeAvailable: (claudeAvailable ??
          null) as HostFacts['accounts']['claudeAvailable'],
        ghLogin,
      },
      probedAt: src.probedAt,
    },
  };
}
