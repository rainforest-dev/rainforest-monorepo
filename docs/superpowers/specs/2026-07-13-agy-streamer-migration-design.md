# agy-streamer: Nx Migration & Refinement — Design

> **Revision 2 note**: revision 1 (still readable in git history) proposed reviving `agent_worker.py` (the Python SDK worker) for real tool-approval gating. That's now confirmed dead-ended — the SDK path requires a separate paid `GEMINI_API_KEY`, contradicting an explicit no-extra-cost constraint (confirmed by actually running it: `AntigravityValidationError: A Gemini API key is required`). This revision replaces it with a working, cost-free alternative found through live testing: driving `agy -i` (genuine interactive mode) through a real pseudo-terminal, which authenticates via the existing Google AI Pro OAuth session — confirmed end-to-end (approval prompt appeared, approved via keystroke, file was created only after approval).

## Summary

`agy-streamer` currently lives as an untracked, uncommitted folder inside `rainforest-homelab` — a TanStack Start web app that lets you remotely drive agy and Claude Code sessions from your phone over Tailscale. It's considerably more built than it first appeared: agent-type switching, a full approval-card UI, directory browsing, and per-session history already work. This design migrates it into `rainforest-monorepo` as a proper Nx app, refines its UI onto the shared dynamic-theme branding, and makes the already-built (but currently non-functional) approval UI real — via PTY-driven interactive CLI automation, not the Python SDK.

## Current State (corrected)

- **Frontend**: TanStack Start (React 19.2, Vite 8), shadcn/ui + Radix, Tailwind v4. Already implements: an agent-type `<select>` (Antigravity / Claude Code), a session sidebar (desktop) / dialog switcher (mobile) with per-type badges, a directory browser with recent-projects shortcuts, SSE-driven live timeline, and a fully-wired approval card (`pendingPermission` state → Approve/Deny → `/approve` route → `handleToolApproval`). Styled with an ad hoc slate/indigo/amber palette and Google Material Symbols icon font, despite `lucide-react` sitting unused in `package.json`.
- **`agent-manager.ts`** (`frontend/src/lib/agent-manager.ts`) is the real backend today. `startAgentSession(sessionId, directory, prompt, agentType)` branches:
  - `agentType === 'claude'`: spawns the real `claude` CLI binary directly (`--session-id <id> -p <prompt> --output-format stream-json --verbose --dangerously-skip-permissions`), parses its JSON stream, appends events to a JSONL transcript log, and polls/broadcasts.
  - default (`agy`): spawns the real `agy` CLI binary directly (`--conversation <id> --add-dir <directory> -p <prompt> --dangerously-skip-permissions`), then tails the transcript log `agy` itself writes to `~/.gemini/antigravity-cli/brain/<id>/.system_generated/logs/transcript.jsonl` and broadcasts new lines over SSE.
  - Neither path ever sets `session.pendingResolve` — `handleToolApproval` and the frontend's approval card are fully wired but functionally dead, because nothing in the live code path ever populates a pending approval.
- **`agent_worker.py`** (Python, `google-antigravity` SDK): confirmed dead end for this project. Live-tested directly (`uv run python agent_worker.py <sid> <dir> <prompt>`) and it fails immediately with `AntigravityValidationError: A Gemini API key is required. Set it via GEMINI_API_KEY environment variable or via LocalAgentConfig(api_key=...)`. Despite pointing `app_data_dir` at the same `~/.gemini/antigravity-cli` folder the CLI's OAuth session lives in, the SDK's `LocalAgentConfig`/`local_connection.py` path does not fall back to that session — it hard-requires a separate key. **Do not use this path.** Leave `agent_worker.py` behind with the other legacy files (see below) — it's not going into `apps/agy-streamer` at all in this revision.
- **The real fix, confirmed working**: `agy -i` (genuine interactive/TUI mode — not `-p`/print mode) supports real per-tool-call approval, authenticated via the same Google AI Pro OAuth session as normal CLI usage (confirmed: the TUI banner shows `rainforestnick@gmail.com (Google AI Pro)`, no API key involved). But it only works when the process has a real pseudo-terminal — plain piped stdin/stdout (what `agent-manager.ts` uses today, and what a first attempt via `expect` without proper PTY handling also failed to drive) doesn't trigger the TUI at all. Verified via `tmux` (which does allocate a real PTY): a file-creation prompt appeared (`"Allow creation of this file? > 1. Yes, allow creation  2. Yes, and always allow non-workspace access  3. No, deny creation"`), sending `"1"` + Enter approved it, and the file was only created after that — genuine human-in-the-loop, no extra cost.
- **`agy -p` (print/non-interactive mode) never pauses for approval**, confirmed by direct testing (with and without `--dangerously-skip-permissions`, and with `--mode plan`) — a write-tool call executed immediately every time. Non-interactive mode has no human-in-the-loop mechanism at all; this rules out any print-mode-based fix.
- **At least three distinct interactive-prompt shapes observed** during testing, all sharing a common visual structure (boxed section, `>` cursor pointing at a numbered option, arrow-key navigation hint, "esc to cancel" footer) but different wording:
  1. Workspace trust (first use of a new directory): `"Do you trust the contents of this project?"` — 2 options (trust / exit).
  2. Command approval: `"Requesting permission for: <command>"` / `"Do you want to proceed?"` — 4 options (yes-once / always-this-conversation / always-persisted / no).
  3. File access/creation: `"Allow creation of this file?"` or `"Allow access to this file?"` — 3 options (yes / yes-always-non-workspace / no).
  4. Not observed despite two attempts (see below) but presumably exists: a subagent-invocation prompt.
- **Subagent behavior tested twice, inconclusive but concerning**: one prompt explicitly asking to "use a subagent," and one implicitly inviting parallel investigation across multiple directories. Neither triggered visible subagent dispatch. Both times the agent instead wandered into unrelated paths (its own `~/.gemini/antigravity-cli/scratch/` and `/Users/rainforest` home root) rather than the directories actually specified in the prompt. **Denying a tool call does not cause the agent to retry or adapt — it simply stops the turn** (observed both times, consistently). Given no reliable evidence either way, the design should not assume or encourage subagent delegation, but the prompt-detection logic must still be general enough to catch an unfamiliar prompt shape if one does appear, rather than hardcoding only the 3 confirmed shapes.
- **`agy agents` returns an empty list** in this environment — no configured personas to select from. Persona/`--agent` selection is dropped from scope entirely (nothing to select).
- **Legacy dead code, confirmed unused anywhere in the frontend** (grepped): `server.py` + `static/` (older FastAPI+WebSocket+vanilla-JS prototype), `scratch/`, `test_worker.py`, `redesigned_stitch_ui.html` (a Stitch design export, never wired to anything). `agent_worker.py` joins this list as of this revision.
- **Git status**: the whole `agy-streamer/` folder is untracked in `rainforest-homelab`; `frontend/.git` is an orphaned nested repo from scaffolding, not a real submodule. No git history to preserve — migration is a plain file copy.
- **Existing test coverage to preserve**: `agent-manager.test.ts` (session lifecycle, SSE client management, approval promise resolution) and `api-integration.test.ts` (route-level, mocks `startAgentSession`).

## Goals

- Move the app into `apps/agy-streamer` in the Nx workspace, following existing conventions.
- Refine the UI onto the workspace's shared dynamic OKLCH `--seed` theming (`libs/rainforest-ui/src/tailwindcss/shadcn.ts`, from PR #236) and `lucide-react` icons, mobile-first.
- **Make approval real** for the `agy` backend by driving `agy -i` through a real PTY (`node-pty`) instead of plain piped `-p` mode, parsing the rendered terminal output for the generic numbered-menu prompt shape, surfacing it through the existing (currently-dead) approval-card UI — now expanded to render however many options a given prompt has (2–4, not just binary Approve/Deny) — and sending the chosen option's number back into the PTY.
- Add `model` selection to the UI, backed by `agy -i --model <x>` (CLI flag, confirmed to work — the TUI banner shows the active model).
- Add a third `codex` branch to `agent-manager.ts` — blocked pending `codex` actually being installed (confirmed not installed on this machine; do not guess at its behavior).
- Keep `claude`/`codex` as-is functionally (already streaming into the same UI via plain non-PTY spawn) — they don't need the PTY/approval treatment, since Claude/Codex's own apps are the place for that; agy-streamer's job for them is convenience access from the phone.

## Non-Goals

- No zero-trust / network-level access control design — Tailscale already restricts network access.
- No production public-internet deployment — Tailscale-only personal tool.
- No attempt to make Claude/Codex sessions' approval flow "real" — out of scope; their own apps own that experience.
- No persona/`--agent` selection — nothing configured to select in this environment.
- No design assumption that subagent delegation works reliably or is encouraged — inconclusive testing, no UI nudging users toward it.

## Architecture

`agent-manager.ts`'s `agy` branch changes from `child_process.spawn` (plain pipes) to `node-pty.spawn`, running genuine interactive mode:

```
agy -i "<prompt>" --add-dir <directory> --conversation <sessionId> [--model <model>]
```

A new module, `apps/agy-streamer/src/lib/agy-pty-parser.ts`, owns turning the raw ANSI-laden PTY output stream into structured events:

- **Strip ANSI/cursor-control codes** (via the `strip-ansi` npm package) before any pattern matching.
- **Generic menu-prompt detector**: look for a `>` at the start of a line immediately followed by `\d+\.\s` (the cursor-selected first option), preceded by the prompt's message text, followed by one or more sibling option lines, and a trailing navigation-hint line (`"esc to cancel"`, `"↑/↓ Navigate"`, etc.). This catches all 3 confirmed prompt shapes *and* an unfamiliar 4th shape (e.g. a subagent prompt) without needing to hardcode exact wording — deliberately general per the "inconclusive subagent testing" finding above.
- **Turn-completion detector**: the idle state (`>` empty input line + `"? for shortcuts"` footer) appearing after prior activity, with no pending menu.
- **Denial-stop detector**: after sending a "no"/deny option, if the very next stable state is the idle prompt (not a new bulleted action), emit a distinct `turn_stopped_after_denial` event rather than a normal `turn_complete` — so the UI can message "Agent stopped — this action was declined" instead of implying it kept working (matches the consistently-observed behavior in testing).
- **Best-effort activity parsing**: bulleted lines (`● ToolName(args)`) and thought blocks (`▸ Thought for Xs, Y tokens`) get appended to the transcript log as readable text, same spirit as today's `PLANNER_RESPONSE`/`TOOL_CALL` log entries, but this is inherently fuzzier than the old JSON-stdout approach (`claude` branch) since it's parsing human-oriented terminal UI, not a structured protocol. Log the raw ANSI-stripped output alongside the parsed events so nothing is silently lost if a pattern isn't recognized.

On a detected menu prompt: broadcast a `permission_request` event with the prompt text and the full option list (not just true/false); store a `pendingResolve` that now resolves with an option *index*, not a boolean; the manager writes `"<index+1>\n"` into the PTY. `handleToolApproval` and the `/approve` route need their signatures widened from `boolean` to `number` (option index) to support the 3–4-option prompts, not just the original binary approve/deny the UI was built for.

The `claude` and `codex` branches are unaffected — they keep using plain `child_process.spawn` with piped stdout, same as today, since real approval-gating isn't the goal for them.

## UI & Branding

Mobile-first, single column, adapting the existing structure rather than replacing it:
- The existing desktop sidebar / mobile dialog-based session switcher stays, restyled onto theme tokens.
- The existing approval card gets widened from binary Approve/Deny to a dynamic option list (2–4 buttons depending on the prompt), and its copy adjusted to show the real prompt text (workspace trust / command / file access) instead of a generic "Action Required" framing, so the user knows what kind of decision they're making.
- A **"Agent stopped" banner** distinct from the normal completion state, shown after a `turn_stopped_after_denial` event, so declining doesn't read as "still working."
- Colors come from the shared `shadcn.ts` OKLCH `--seed` plugin instead of the current hardcoded slate/indigo/amber classes.
- Material Symbols icon font swapped for `lucide-react` (already an unused dependency).
- Add a `model` text input next to the existing agent-type `<select>`, shown only for the `agy` agent type, passed through as `--model`.
- No persona selector (dropped — nothing to select).

## Data Flow

**Starting a session (agy)**: phone submits `{directory, prompt, agentType: 'agy', model?}` → route calls `startAgentSession` → spawns `agy -i` via `node-pty` with `--conversation sessionId` (+ `--model` if set) → SSE stream opens keyed by sessionId → the PTY parser's structured events (activity, menu prompts, turn-complete, turn-stopped-after-denial) pipe through to the timeline.

**Approval round-trip (agy, now real)**: parser detects a menu prompt → manager stores `pendingResolve` (now resolves with an option index) and broadcasts the prompt text + full option list → phone's approval card renders the real options → user picks one → POST `/approve` with the chosen index → `handleToolApproval` resolves the promise → manager writes `"<n>\n"` into the PTY → agent resumes (or stops, if it was a denial — see above).

**Claude/Codex**: unchanged from today's `claude` branch pattern — spawn, parse stdout stream, broadcast, no approval gating.

**Persistence**: JSONL transcript per session continues as today, now including the raw ANSI-stripped PTY output as a fallback field alongside parsed events, so nothing is lost if the parser misses a pattern.

## Error Handling

- **PTY process crash mid-stream**: SSE emits a terminal `error` event (mirrors the existing `child.on('error')`/`child.on('close')` handling, adapted for `node-pty`'s exit event, which has a slightly different shape than `child_process`'s).
- **Phone drops connection mid-stream**: SSE auto-reconnects; verify the reconnect path replays from the transcript log (`fetchSessionHistory` already loads history on route load, so a full navigation-away-and-back recovers state — confirm a bare SSE reconnect without full navigation also does, or document the limitation).
- **Approval card pending when connection drops**: the PTY process just sits at the prompt indefinitely; nothing times out. On reconnect, the same pending card must re-render from persisted state, not just from a live SSE event that already passed.
- **Menu prompt not recognized by the parser** (unfamiliar shape, e.g. a real subagent prompt): logged as raw text so it's at least visible in the transcript, but the session will appear to hang from the UI's perspective since no approval card renders. This is a known limitation of the generic-but-imperfect parser — flag prominently rather than silently swallow.
- **`codex`/`claude` fail to spawn**: `child.on('error')` already broadcasts an `error` event — unaffected by this revision.

## Testing

- Port `agent-manager.test.ts` and `api-integration.test.ts` as-is (mock the subprocess boundary same as today).
- Add unit tests for `agy-pty-parser.ts` against **captured fixture output** from the real testing done for this spec (the exact ANSI-stripped text of the workspace-trust, command-approval, and file-access prompts) — this is the highest-value test surface, since it's genuinely new, fuzzy parsing logic with real failure modes.
- No e2e/browser test suite — pragmatic scope for a single-user tool, though a manual PTY-driven smoke test (same pattern as this spec's own verification) is worth running once after implementation.

## Migration & Nx Specifics

- New Nx app at `apps/agy-streamer`. `@nx/vite/plugin` is already registered in `nx.json` and will auto-infer build/serve/preview/typecheck targets from the existing `vite.config.ts`.
- **TypeScript**: bump the workspace catalog (`pnpm-workspace.yaml`) from `5.9.3` to `6.0.3` (confirmed latest stable; TypeScript 7 is currently only dated dev-nightlies). Workspace-wide bump — verify `pnpm nx run-many -t typecheck` still passes across all projects after.
- **Theming**: port `libs/rainforest-ui/src/tailwindcss/shadcn.ts` from PR #236 (self-contained) — check PR state first in case it's merged by implementation time, and check whether the separately-dispatched rss-manager theming task already ported it somewhere reusable.
- **No Python at all**: `agent_worker.py` is left behind with the other legacy files — Nx has no real Python support and the SDK path is a dead end anyway. `apps/agy-streamer` is pure TS/React, plus the new `node-pty` native dependency.
- **Deployment split**: code lives in `rainforest-monorepo` (Nx tooling, shared theming), but the *running service* is deployed and managed from `rainforest-homelab` via a `launchd` agent bound to the Tailscale IP — the app needs local subprocess/PTY-spawn access to `agy`/`claude`/`codex` that only exists on this Mac and can't move to a cloud platform (unlike `personal-website`'s Vercel deploy).
- **Left behind, not migrated**: `server.py`, `static/`, `scratch/`, `test_worker.py`, `redesigned_stitch_ui.html`, `agent_worker.py`, `pyproject.toml`, `uv.lock` — all confirmed dead/unused or a dead-end approach.
- **Compatibility already confirmed**: React 19.2, Tailwind v4, ES2022 target, and strict-mode TS flags already match this workspace's conventions.
