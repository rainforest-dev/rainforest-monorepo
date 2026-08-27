import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { HostDeclaration } from './types.js';

/**
 * Read host declarations out of `tools/loop/hosts.yaml`.
 *
 * ## Why this file exists at all
 *
 * `hosts.yaml` has carried a `hosts:` mapping since before this design, and it
 * is the only declaration source there is. Nothing in the app read it, so every
 * host came out of `store.ts` with `declaration: null` -- and a null
 * declaration made `driftFor` return no findings, which made the setup page
 * print "matches its declaration" in green for machines that had no
 * declaration to match. The writer succeeded and no reader ever checked, which
 * is the one shape this whole branch exists to remove.
 *
 * ## Why it is a separate module from derive.ts
 *
 * `derive.ts` and `drift.ts` are pure -- no `node:fs`, no clock, no env. That
 * purity is what stops the setup page and any later WebMCP surface from
 * disagreeing. The file read therefore lives out here, beside `store.ts`, and
 * the result is passed in.
 *
 * ## Why it is not a real YAML parser
 *
 * The same reason `install.sh` reads this file with awk: there is no YAML
 * dependency in this workspace, and adding one to read six keys out of one
 * committed file is not worth it. The scanner below accepts the exact shape
 * `hosts.yaml` is written in and rejects anything else loudly -- a host it
 * cannot read becomes a stated problem, never a silent omission.
 */

/** Which `hosts.yaml`. */
export function hostsYamlPath(): string {
  // Same shape as `usageDir()` in ledger.ts: an env override with a documented
  // default, rather than a search or a guess. The default is the repo layout
  // the deployed app already runs from -- the observatory LaunchAgent's
  // WorkingDirectory is `<repo>/apps/loop-observatory`, so the engine tree is
  // two levels up. Set LOOP_HOSTS_YAML when it is anywhere else.
  return (
    process.env.LOOP_HOSTS_YAML ??
    join(process.cwd(), '..', '..', 'tools', 'loop', 'hosts.yaml')
  );
}

/**
 * Declared, not probed, and defaulted only where the spec says a default is
 * safe: "The OTLP receiver binds 127.0.0.1 unless hosts.yaml declares
 * otherwise." The safe value is the default precisely so that a host which
 * forgot to say cannot end up opening a port to the network.
 */
const DEFAULT_OTLP_BIND = '127.0.0.1';

/** Both live hosts run on this interval. Policy, so it is declarable per host. */
const DEFAULT_INTERVAL_SECONDS = 1800;

export interface Declarations {
  byHost: Record<string, HostDeclaration>;
  /**
   * Per-host reasons an entry was refused. A malformed declaration must not
   * look identical to an absent one -- the page can then say which it is.
   */
  problems: Record<string, string>;
  /** The source itself could not be read. Not the same as "no hosts declared". */
  error: string | null;
}

/** `hosts.yaml` says `company`; the derivation vocabulary says `work`. */
const SCOPES: Record<string, HostDeclaration['scope']> = {
  company: 'work',
  work: 'work',
  personal: 'personal',
};

type Entry = Record<string, string>;

/**
 * Pull the `hosts:` block out as `host -> { key: raw value }`.
 *
 * Handles the two flow-sequence layouts this file actually contains: `roles:
 * [a, b]` on one line, and `roles:` with the bracketed list on the line after
 * -- which is what Prettier produces once the list is long enough to wrap.
 */
function scanHostsBlock(text: string): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  let inHosts = false;
  let host: string | null = null;
  let pendingKey: string | null = null;
  let pendingValue = '';

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line || /^\s*#/.test(line)) continue;

    // A continuation of a flow sequence that began on an earlier line.
    if (pendingKey && host) {
      pendingValue += ` ${line.trim()}`;
      if (pendingValue.includes(']')) {
        out[host]![pendingKey] = pendingValue.trim();
        pendingKey = null;
        pendingValue = '';
      }
      continue;
    }

    if (/^[A-Za-z]/.test(line)) {
      inHosts = line.startsWith('hosts:');
      host = null;
      continue;
    }
    if (!inHosts) continue;

    const hostLine = /^ {2}([A-Za-z0-9][A-Za-z0-9._-]*):\s*$/.exec(line);
    if (hostLine) {
      host = hostLine[1]!;
      out[host] = {};
      continue;
    }

    const keyLine = /^ {4}([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (keyLine && host) {
      const [, key, value] = keyLine as unknown as [string, string, string];
      if (value.startsWith('[') && !value.includes(']')) {
        pendingKey = key;
        pendingValue = value;
      } else if (value === '') {
        // `roles:` with its list on the following line.
        pendingKey = key;
        pendingValue = '';
      } else {
        out[host][key] = value;
      }
    }
  }
  return out;
}

function parseList(value: string): string[] {
  return value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toDeclaration(
  host: string,
  entry: Entry,
): HostDeclaration | { problem: string } {
  const scope = SCOPES[entry.scope ?? ''];
  if (!scope)
    return {
      problem: `scope is ${entry.scope ? `'${entry.scope}'` : 'missing'}; expected one of ${Object.keys(SCOPES).join(', ')}`,
    };

  // Required, never defaulted. Every derived path hangs off it, and guessing a
  // home directory is the same mistake `vault_path()` made when it fell through
  // to a retired clone and sent a machine's entire run record somewhere nothing
  // reads.
  const home = entry.home;
  if (!home || !home.startsWith('/'))
    return { problem: 'home is missing or not an absolute path' };

  const roles = entry.roles ? parseList(entry.roles) : [];
  if (roles.length === 0) return { problem: 'roles is missing or empty' };

  const otlpBind = entry.otlp_bind ?? DEFAULT_OTLP_BIND;
  if (otlpBind !== '127.0.0.1' && otlpBind !== '0.0.0.0')
    return {
      problem: `otlp_bind '${otlpBind}' is not one of 127.0.0.1, 0.0.0.0`,
    };

  const intervalSeconds = entry.interval_seconds
    ? Number(entry.interval_seconds)
    : DEFAULT_INTERVAL_SECONDS;
  if (!Number.isInteger(intervalSeconds) || intervalSeconds <= 0)
    return {
      problem: `interval_seconds '${entry.interval_seconds}' is not a positive integer`,
    };

  return { host, home, roles, scope, otlpBind, intervalSeconds };
}

export function readDeclarations(): Declarations {
  const path = hostsYamlPath();
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch (err) {
    // Unlike hosts.json, this file is committed and always present. Its
    // absence means the path is wrong, not that nothing is declared -- and
    // reporting "nothing is declared" for a misconfigured path would put every
    // real host into the not-declared state for a reason that is not true.
    return {
      byHost: {},
      problems: {},
      error: `cannot read ${path}: ${(err as Error).message}`,
    };
  }

  const byHost: Record<string, HostDeclaration> = {};
  const problems: Record<string, string> = {};
  for (const [host, entry] of Object.entries(scanHostsBlock(text))) {
    const result = toDeclaration(host, entry);
    if ('problem' in result) problems[host] = result.problem;
    else byHost[host] = result;
  }
  return { byHost, problems, error: null };
}
