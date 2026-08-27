import type { HostFacts } from './types.js';

export interface Probe {
  id: keyof HostFacts;
  why: string;
  shell: string;
}

/**
 * Bumped whenever the list changes. The device fetches this list rather than
 * embedding it, so adding a derivation input later means adding a probe here and
 * every machine picks it up on its next run — nothing on the machine updates.
 */
export const PROBE_VERSION = 1;

export const PROBES: Probe[] = [
  {
    id: 'tccICloud',
    why: 'Whether launchd on this host may read ~/Library/Mobile Documents. Decides whether ralph runs directly or through the GUI shim. Measured 2026-08-25: denied on the Air, permitted on the mini.',
    shell:
      'if [ -r "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian" ]; then echo permitted; else echo denied; fi',
  },
  {
    id: 'executors',
    why: 'Which agents exist here, for LOOP_EXECUTORS. Absent ones must not be listed or ralph will try to launch a binary that is not there.',
    shell:
      'for b in claude codex agy; do command -v "$b" >/dev/null 2>&1 && printf "%s\\n" "$b"; done',
  },
  {
    id: 'brewPrefix',
    why: 'Apple silicon uses /opt/homebrew and Intel uses /usr/local. Wrong prefix means a PATH that resolves nothing.',
    shell: 'brew --prefix 2>/dev/null || echo ""',
  },
  {
    id: 'otlpListening',
    why: "Whether anything accepts the OTLP ralph exports. False for the Air's entire life, which is the whole of why it never emitted a single claude_code metric.",
    shell:
      'nc -z -G 2 127.0.0.1 4318 >/dev/null 2>&1 && echo true || echo false',
  },
  {
    id: 'vaultPath',
    why: 'Where the vault is, if this host can read it. Decides LOOP_QUOTA_FILE, because ralph.sh:314 defaults to a runtime layout only one host has.',
    shell:
      'p="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian"; [ -d "$p" ] && printf "%s" "$p" || printf ""',
  },
  {
    id: 'accounts',
    why: 'Which accounts claude and gh resolved to. Never a token — this is what lets the app catch a company machine logged into a personal account without seeing any credential.',
    shell:
      'printf "%s|%s" "$(claude --version >/dev/null 2>&1 && echo ok || echo missing)" "$(gh api user --jq .login 2>/dev/null || echo unknown)"',
  },
];
