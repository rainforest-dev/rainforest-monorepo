import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Which engine release each machine is running, and whether they agree.
 *
 * On 2026-09-02 the Air ran an engine three releases behind the mini's. Nothing
 * said so: the only way to find out was to ssh in and grep a source file for a
 * function that the newer release had added. Every panel here was green while
 * one host could not have honoured a rule the other enforced.
 *
 * Read from `projects.<machine>.json`, which `loopctl scan` already publishes
 * hourly from both machines. The enrollment probes would have been the obvious
 * channel and are the wrong one: adding a probe bumps the protocol version, and
 * every installed bundle then refuses to enrol until it is replaced -- a
 * coordinated reinstall to report the very thing that tells you a reinstall is
 * due.
 */

/** One machine's answer, or its silence. */
export interface EngineReport {
  machine: string;
  /** The release string, or null when that host has never reported one. */
  version: string | null;
  /** When this host last published, so a silent host is not read as current. */
  publishedAt: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Every machine that has published, sorted by name so the order is stable. */
export function readEngineReports(usageDir: string): EngineReport[] {
  let names: string[];
  try {
    names = readdirSync(usageDir);
  } catch {
    return [];
  }
  const out: EngineReport[] = [];
  for (const name of names) {
    const machine = /^projects\.(.+)\.json$/.exec(name)?.[1];
    if (!machine) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(
        readFileSync(join(usageDir, name), 'utf-8'),
      ) as Record<string, unknown>;
    } catch {
      // One unreadable file must not hide the other machine's answer.
      continue;
    }
    out.push({
      machine,
      version: str(parsed.engine_version),
      publishedAt: str(parsed.published_at),
    });
  }
  return out.sort((a, b) => a.machine.localeCompare(b.machine));
}

/**
 * The sentence to show, or null when there is nothing worth saying.
 *
 * Silence is not agreement. A host that publishes no version is called out by
 * name rather than folded into "all machines agree", because that host is
 * exactly the one that predates the version being reported at all -- which is
 * the same thing as being behind.
 */
export function engineDrift(reports: EngineReport[]): string | null {
  if (!reports.length) return null;
  const known = reports.filter((r) => r.version);
  const silent = reports.filter((r) => !r.version).map((r) => r.machine);
  const versions = [...new Set(known.map((r) => r.version as string))];

  if (!known.length) {
    return `no machine reports an engine version (${silent.join(', ')}) — none has been installed from a bundle since this was added`;
  }
  const parts = reports.map(
    (r) => `${r.machine} ${r.version ?? 'not reported'}`,
  );
  if (versions.length === 1 && !silent.length) {
    return `engines agree · ${versions[0]}`;
  }
  return `engines differ · ${parts.join(' · ')}`;
}
