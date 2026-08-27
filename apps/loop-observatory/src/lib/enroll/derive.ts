// apps/loop-observatory/src/lib/enroll/derive.ts
import { type PlistValue, toPlist } from './plist.js';
import {
  type DerivedFile,
  type HostDeclaration,
  type HostFacts,
  UnknownFact,
} from './types.js';

const RALPH_LABEL = 'tools.rainforest.loop-ralph';

function loopHome(d: HostDeclaration): string {
  return `${d.home}/.claude/loop`;
}

function quotaFile(d: HostDeclaration, f: HostFacts): string | null {
  // ralph.sh:314 defaults to $HOME/.local/share/loop-usage-runtime/..., which is
  // the layout of a host that keeps a runtime copy because launchd there cannot
  // read iCloud. A host reading the vault directly needs an explicit path, and
  // that is a property of where its quota lives, not of its name.
  if (!f.vaultPath) return null;
  return `${f.vaultPath}/_system/usage/quota.${d.host}.json`;
}

export function deriveRalphPlist(
  d: HostDeclaration,
  f: HostFacts,
): DerivedFile {
  if (f.tccICloud === 'unknown') throw new UnknownFact('tccICloud');

  const env: Record<string, string> = {
    PATH: `${d.home}/.local/bin:${f.brewPrefix}/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
  };
  const body: Record<string, PlistValue> = {
    Label: RALPH_LABEL,
    ProgramArguments: [`${loopHome(d)}/ralph.sh`],
    EnvironmentVariables: env,
    RunAtLoad: true,
    StartInterval: d.intervalSeconds,
    ThrottleInterval: 60,
    StandardOutPath: `${loopHome(d)}/ralph.log`,
    StandardErrorPath: `${loopHome(d)}/ralph.err.log`,
  };

  env.LOOP_MACHINE = d.host;
  if (f.executors.length > 0) env.LOOP_EXECUTORS = f.executors.join(',');
  const quota = quotaFile(d, f);
  if (quota) env.LOOP_QUOTA_FILE = quota;
  if (f.vaultPath)
    env.LOOP_AGENT_CONFIG = `${f.vaultPath}/_system/usage/loop-agents.json`;

  return {
    path: `Library/LaunchAgents/${RALPH_LABEL}.plist`,
    contents: toPlist(body),
  };
}
