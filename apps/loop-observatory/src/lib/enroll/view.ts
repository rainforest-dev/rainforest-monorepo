import { derive } from './derive.js';
import { driftFor, type Drift } from './drift.js';
import type { HostRecordMap } from './store.js';
import type { DerivedFile } from './types.js';

export interface HostView {
  drift: Drift[];
  files: DerivedFile[];
  error: string | null;
}

/**
 * Pair every host with its drift and its derived files.
 *
 * A host whose derivation refuses shows the refusal; it does not blank the page.
 * One machine with a probe that did not run must not hide the others.
 */
export function buildHostViews(
  records: HostRecordMap,
  now: number,
): Record<string, HostView> {
  const out: Record<string, HostView> = {};
  for (const [host, record] of Object.entries(records)) {
    const drift = driftFor(record, now);
    if (!record.declaration || !record.facts) {
      out[host] = { drift, files: [], error: null };
      continue;
    }
    try {
      out[host] = {
        drift,
        files: derive(record.declaration, record.facts),
        error: null,
      };
    } catch (e) {
      out[host] = { drift, files: [], error: (e as Error).message };
    }
  }
  return out;
}
