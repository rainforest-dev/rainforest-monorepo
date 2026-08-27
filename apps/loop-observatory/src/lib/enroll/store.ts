import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { usageDir } from '../ledger.js';
import type { HostDeclaration, HostFacts } from './types.js';

export interface HostRecord {
  declaration: HostDeclaration | null;
  facts: HostFacts | null;
  reportedAt: number | null;
}

export type HostRecordMap = Record<string, HostRecord>;

export function hostsPath(): string {
  return join(usageDir(), 'hosts.json');
}

/**
 * Device records. Rebuilt by re-enrolling, never a source of truth — which is
 * why this file must stay out of git. `_system/usage/` ignores runtime files
 * individually rather than by directory (its own comment reads "Config files
 * (model-rates.json, task-map.json) stay committed"), so hosts.json inherits
 * nothing and needs its own entry.
 */
export function readHosts(): HostRecordMap {
  try {
    const parsed: unknown = JSON.parse(readFileSync(hostsPath(), 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};
    return parsed as HostRecordMap;
  } catch {
    return {};
  }
}

export function recordFacts(host: string, facts: HostFacts, now: number): void {
  const hosts = readHosts();
  hosts[host] = {
    ...(hosts[host] ?? { declaration: null }),
    facts,
    reportedAt: now,
  };
  const dir = usageDir();
  mkdirSync(dir, { recursive: true });
  // Write beside, then rename: a reader must never see a half-written record.
  const tmp = join(dir, `.hosts.json.${process.pid}.tmp`);
  writeFileSync(tmp, `${JSON.stringify(hosts, null, 2)}\n`);
  renameSync(tmp, hostsPath());
}
