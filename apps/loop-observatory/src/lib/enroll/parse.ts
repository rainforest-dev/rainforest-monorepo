import type { HostFacts } from './types.js';

/** A plain hostname. The value becomes a key in a JSON file and a display label. */
const SAFE_HOST = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const TCC = new Set(['permitted', 'denied', 'unknown']);
const CLAUDE_AVAILABLE = new Set(['ok', 'missing']);

/**
 * Every unbounded field, bounded.
 *
 * These values are written under a host key into `_system/usage/hosts.json`,
 * which is iCloud-synced, and the endpoint that writes them is unauthenticated
 * on the tailnet (see the header of `pages/api/enroll/facts.ts`). Only the host
 * name was bounded before, so a caller could fill that disk through any of the
 * other fields, or through host keys alone.
 *
 * Every limit is REJECT, never truncate. A truncated fact is not what the
 * machine reported, and storing one would mean the record says something no
 * probe ever said -- the exact class of lie this system exists to prevent.
 *
 * Sizes are generous against real values and small against a disk: the longest
 * real `vaultPath` observed is 96 characters, the longest `brewPrefix` 13, and
 * GitHub caps a login at 39.
 */
const MAX_EXECUTORS = 16;
const EXECUTOR = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const MAX_PATH_LEN = 1024;
const MAX_TIMESTAMP_LEN = 40;
/** GitHub's own rule: 1-39 of [A-Za-z0-9-], no leading/trailing/double hyphen. */
const GH_LOGIN = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/;

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

  // Bounds. Rejections, not truncations -- see the constants above.
  if (executors.length > MAX_EXECUTORS) return null;
  if (!executors.every((e) => EXECUTOR.test(e))) return null;
  if (src.brewPrefix.length > MAX_PATH_LEN) return null;
  if (src.vaultPath !== null && (src.vaultPath as string).length > MAX_PATH_LEN)
    return null;
  // A timestamp, not merely a short string: `probedAt` is displayed as a fact
  // about when reality was last read, and an unparseable one would be shown
  // with the same authority as a real reading.
  if (
    src.probedAt.length > MAX_TIMESTAMP_LEN ||
    Number.isNaN(Date.parse(src.probedAt))
  ) {
    return null;
  }

  // Empty means "gh reported no login", which is null -- a state drift.ts
  // reports as `account-unverified`. It is NOT a login named "" and it is not
  // the word the old probe used to emit; see probes.ts.
  const rawGhLogin = typeof a.ghLogin === 'string' ? a.ghLogin.trim() : null;
  if (rawGhLogin !== null && rawGhLogin !== '' && !GH_LOGIN.test(rawGhLogin))
    return null;
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
