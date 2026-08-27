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
export const PROBE_VERSION = 2;

export const PROBES: Probe[] = [
  {
    id: 'tccICloud',
    why: 'Whether launchd on this host may read ~/Library/Mobile Documents. Decides whether ralph runs directly or through the GUI shim. Measured 2026-08-25: denied on the Air, permitted on the mini. Emits unknown when the question cannot be asked at all, because a probe that fails to run must never be reported as a default -- "denied" would silently select the osascript GUI shim on a machine that is actually permitted.',
    shell:
      // Three answers, not two. The first branch is what makes `unknown`
      // reachable: this is a macOS TCC question, so anywhere that is not macOS,
      // and any environment with no usable $HOME, cannot answer it -- as opposed
      // to answering "denied". `derive.ts` refuses on unknown rather than
      // guessing, which is the whole point of having the third answer.
      'case "$(uname -s 2>/dev/null)" in Darwin) ;; *) echo unknown; exit 0 ;; esac; ' +
      '[ -n "$HOME" ] && [ -d "$HOME" ] || { echo unknown; exit 0; }; ' +
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
    why: 'Which accounts claude and gh resolved to. Never a token — this is what lets the app catch a company machine logged into a personal account without seeing any credential. An unauthenticated gh reports an EMPTY login, never a placeholder word.',
    shell:
      // The gh half emits "" rather than a word when gh is absent or logged
      // out. It used to emit the literal string `unknown`, which parse.ts then
      // accepted as a real GitHub login, so drift.ts reported "work machine
      // resolved gh to unknown" -- an account MISMATCH raised against a machine
      // that simply was not logged in. Those are different states and the
      // system now tells them apart: empty becomes null, and null on a work
      // machine raises `account-unverified`, not `account-mismatch`.
      'printf "%s|%s" "$(claude --version >/dev/null 2>&1 && echo ok || echo missing)" "$(gh api user --jq .login 2>/dev/null || true)"',
  },
];
