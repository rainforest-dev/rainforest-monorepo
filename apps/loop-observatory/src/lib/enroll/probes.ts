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
    why: 'Whether LAUNCHD on this host may read ~/Library/Mobile Documents. Decides whether ralph runs directly or through the GUI shim. SIDE EFFECT, stated because it is unusual for a probe: this bootstraps a throwaway LaunchAgent into gui/<uid>, reads its one line of output, and boots it out again. It is not a service and nothing survives the probe -- but a machine told never to load a LaunchAgent should know this step does, deliberately. Emits unknown when the question cannot be asked, because a probe that fails to run must never be reported as a default.',
    shell:
      // Measures launchd, because launchd is the question.
      //
      // This probe used to ask `[ -r <vault> ]` in whatever shell was running
      // it. That answers "can THIS process read the vault", which under TCC is
      // a different question with a different answer: an interactive session is
      // routinely permitted where launchd is denied. The `why` above claimed
      // launchd the whole time. On 2026-08-28 the Air reported `permitted` from
      // an enrolling agent's shell and derivation produced a direct-exec ralph
      // plist -- the form the GUI shim exists to avoid. It happened to be
      // right, because that machine's TCC had changed since it was last
      // measured, but it was right by accident.
      //
      // The only honest way to ask about launchd is to ask launchd. Every exit
      // path removes the agent and the temp directory; anything that stops the
      // question being asked at all -- not macOS, no launchctl, no usable
      // $HOME, a refused bootstrap, no answer within five seconds -- returns
      // unknown, and derive.ts refuses on unknown rather than guessing.
      'case "$(uname -s 2>/dev/null)" in Darwin) ;; *) echo unknown; exit 0 ;; esac; ' +
      'command -v launchctl >/dev/null 2>&1 || { echo unknown; exit 0; }; ' +
      '[ -n "$HOME" ] && [ -d "$HOME" ] || { echo unknown; exit 0; }; ' +
      'V="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian"; ' +
      'D=$(mktemp -d) || { echo unknown; exit 0; }; ' +
      'L="tools.rainforest.loop-tccprobe.$$"; R="$D/answer"; ' +
      // Written to a temp dir, never to ~/Library/LaunchAgents: anything left
      // in that directory loads again at the next login, and a probe must not
      // be able to outlive itself.
      'printf \'%s\\n\' \'<?xml version="1.0" encoding="UTF-8"?>\' ' +
      '\'<plist version="1.0"><dict>\' ' +
      '"<key>Label</key><string>$L</string>" ' +
      "'<key>ProgramArguments</key><array><string>/bin/sh</string><string>-c</string>' " +
      '"<string>if [ -r \\"$V\\" ]; then echo permitted > \\"$R\\"; else echo denied > \\"$R\\"; fi</string></array>" ' +
      '\'<key>RunAtLoad</key><true/></dict></plist>\' > "$D/p.plist"; ' +
      'launchctl bootstrap "gui/$(id -u)" "$D/p.plist" >/dev/null 2>&1 || { rm -rf "$D"; echo unknown; exit 0; }; ' +
      'i=0; while [ ! -s "$R" ] && [ "$i" -lt 50 ]; do sleep 0.1; i=$((i+1)); done; ' +
      'launchctl bootout "gui/$(id -u)/$L" >/dev/null 2>&1; ' +
      'ANS=$(cat "$R" 2>/dev/null); rm -rf "$D"; ' +
      'case "$ANS" in permitted|denied) echo "$ANS" ;; *) echo unknown ;; esac',
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
      // The gh half is guarded on gh's EXIT CODE, not on 2>/dev/null. With a
      // stale token `gh api user` prints its 401 body to stdout and exits 1, so
      // silencing stderr let the whole JSON through as the login: measured on
      // Angibles-MacBook-Air 2026-08-28, the probe emitted
      // `missing|{ "message": "Requires authentication", ... }`. parse.ts would
      // reject that against GH_LOGIN and answer 400 — correct, but the machine
      // learns only "invalid facts". Empty is the honest value here, and the
      // app already reads it as account-unverified.
      'printf "%s|%s" "$(claude --version >/dev/null 2>&1 && echo ok || echo missing)" "$(if L=$(gh api user --jq .login 2>/dev/null); then printf %s "$L"; fi)"',
  },
];
