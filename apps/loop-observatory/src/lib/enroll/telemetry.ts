import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { usageDir } from '../ledger.js';

/**
 * The OTHER answer to "is this host alive".
 *
 * Two independent readings exist and nothing compared them. The enrollment
 * record (`hosts.json`) is written by `enroll.sh`, which a person runs once, and
 * `drift.ts` calls it stale after fifteen minutes. The quota snapshot
 * (`quota.<host>.json`) is written by the hourly usage job, automatically, on
 * both machines. On 2026-08-29 the two files on disk read:
 *
 *     quota.rainforest-mini.json   17:05 today
 *     hosts.json                   18:15 yesterday
 *
 * So the Overview said rainforest-mini was seen four minutes ago while Setup
 * said it had not reported recently enough to be trusted — one machine, two
 * clocks, opposite conclusions, and no page that showed both.
 *
 * This reader exists so the disagreement can be displayed rather than resolved.
 * It is deliberately NOT a replacement for the enrollment record: a fresh quota
 * file proves the hourly job ran, which is not the same as the facts being
 * current. A machine can refresh its quota on schedule while the gh token those
 * facts describe expired days ago — exactly the state `account-unverified`
 * exists to catch.
 */
export interface TelemetryReading {
  /** Epoch ms the host last wrote a quota snapshot. */
  at: number;
  /** Named in the UI, so a reader can tell which file an age came from. */
  source: string;
}

export function readTelemetry(
  hosts: string[],
  dir: string = usageDir(),
): Record<string, TelemetryReading> {
  const out: Record<string, TelemetryReading> = {};
  for (const host of hosts) {
    const name = `quota.${host}.json`;
    try {
      const raw = JSON.parse(readFileSync(join(dir, name), 'utf-8')) as {
        written_at?: unknown;
      };
      // Seconds, float, as export_quota.py writes it. Its own value rather than
      // the file's mtime: iCloud rewrites mtimes on sync, which is how a
      // four-to-nine-day-old snapshot once read as two minutes old.
      const at = raw.written_at;
      if (typeof at === 'number' && Number.isFinite(at)) {
        out[host] = { at: Math.round(at * 1000), source: name };
      }
    } catch {
      // Absent or unreadable is not an error here. It means this host has no
      // second reading, and the view says so rather than inventing one.
    }
  }
  return out;
}
