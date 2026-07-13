# agy-streamer: Nx Migration & Refinement — Design

## Summary

`agy-streamer` currently lives as an untracked, uncommitted folder inside `rainforest-homelab` — a TanStack Start web app that lets you remotely drive and monitor `agy` (Antigravity CLI) agent sessions from your phone over Tailscale, including zero-trust tool-call approval. This design migrates it into `rainforest-monorepo` as a proper Nx app, refines its UI to follow the workspace's shared dynamic-theme branding, and extends it to also *launch* (not fully control) Claude Code and Codex sessions, since those tools already have their own remote-control apps.

## Current State

- **Frontend**: TanStack Start (React 19.2, Vite 8, file-based routes incl. server routes), shadcn/ui + Radix, Tailwind v4. ~3,250 lines of TS/TSX across 11 route files. Actively used, reasonably well-built.
- **Backend**: `agent_worker.py` — a Python script (FastAPI/pydantic deps via `uv`) spawned as a subprocess per turn by the TanStack server routes. Connects to the `google-antigravity` SDK, intercepts tool-call permissions, streams newline-JSON events (`thought`, `token`, `tool_call_start`, `tool_call_end`, `permission_request`) over stdout.
- **Legacy dead code**: `server.py` + `static/` is an older, superseded FastAPI+WebSocket+vanilla-JS prototype (confirmed via the current README, which documents the TanStack Start architecture as authoritative). `scratch/`, `test_worker.py`, `redesigned_stitch_ui.html` are dev debris / a design mockup export.
- **Git status**: the whole `agy-streamer/` folder is untracked in `rainforest-homelab`; `frontend/.git` is an orphaned nested repo from scaffolding, not a real submodule. No git history to preserve — migration is a plain file copy.
- **Known gap**: `agent_worker.py` accepts a `session_id` argument but never passes it as `conversation_id` into `LocalAgentConfig` (which does support that field, confirmed via SDK introspection) — so sessions today are not resumable via the native `agy` CLI's own `/resume`.

## Goals

- Move the current (single-agent, agy-only) functionality into `apps/agy-streamer` in the Nx workspace, following existing workspace conventions.
- Refine the UI: mobile-first layout, following the workspace's shared dynamic OKLCH `--seed`-based theming (`libs/rainforest-ui/src/tailwindcss/shadcn.ts`, introduced in PR #236) instead of either the old app's ad hoc styling or the Stitch mockup's hardcoded palette.
- Fix session continuity: wire `conversation_id` through so sessions started remotely can be continued in the native `agy` CLI.
- Add lightweight session-*launching* (not full remote control) for Claude Code and Codex, using the same local-subprocess-spawn mechanism as agy — since those tools already have their own remote-control apps, agy-streamer's job for them is just to kick off a session while away from the desk.

## Non-Goals

- No zero-trust / network-level access control design work — Tailscale already restricts network access; the app just needs to be reachable on the Tailnet, nothing more.
- No full streaming/approval UI for Claude Code or Codex sessions — their own apps already do this. Duplicating it is explicitly out of scope.
- No production public-internet deployment — this remains a Tailscale-only personal tool.

## Architecture

A `SessionBackend` interface with three implementations behind one unified session model:

- **agy backend** (full experience): spawns `agent_worker.py <session_id> <directory> <prompt>`, now with `conversation_id=session_id` wired into `LocalAgentConfig`. Streams all events over SSE into the timeline. Full tool-approval round-trip.
- **Claude Code backend** (launcher only): spawns `claude -p "<prompt>"` locally in the given directory, confirms it started, returns immediately. No streaming.
- **Codex backend** (launcher only): spawns `codex exec "<prompt>"` locally in the given directory, confirms it started, returns immediately. No streaming.

The frontend renders one unified session list regardless of backend; only agy sessions expand into a live timeline — Claude/Codex sessions show a static "Launched — continue in Claude/Codex app" card instead.

**Open risk, to verify during implementation**: whether a locally-spawned `claude`/`codex` CLI session automatically becomes visible/resumable in Claude's or Codex's own mobile/web apps is not yet confirmed. If it doesn't "just work," the Claude/Codex backends may need additional wiring (or this becomes a documented limitation rather than a blocker — the launch itself still has value even if the handoff isn't automatic).

## UI & Branding

Mobile-first, single column. No persistent sidebar — session list lives in a swipe-in drawer / bottom nav; default view is the active session's timeline.

Visual language borrows Stitch's *structure* (message-type left-border accent, monospace for code/tool output, collapsible "thought process", timestamped blocks) but **colors come from the shared `shadcn.ts` OKLCH `--seed` plugin**, not Stitch's hardcoded palette (`#6366f1` indigo, `#d97706` "Claude orange", etc.) — consistent with personal-website's dynamic theming, so a workspace-wide seed color change re-themes this app too.

Three session-card states in the list:
- **agy, live**: live indicator, tap to open the full timeline.
- **Claude/Codex, launched**: a single static "Launched — continue in Claude/Codex app" card, no further interaction.
- **closed/idle**: dimmed; tap opens a read-only transcript replay for agy sessions (nothing to view for Claude/Codex, since agy-streamer never captured their content).

Pending tool-call approval renders as a card inline in the timeline scroll (not a modal interrupt), with a small unread-style badge on the session's list entry so it's noticeable without the app open.

## Data Flow

**Starting a session**: phone submits `{directory, prompt, backend}` to a server route.
- `agy`: route generates a `session_id`, spawns the worker with `conversation_id=session_id`, opens an SSE stream keyed by that id.
- `claude` / `codex`: route spawns the CLI locally, returns a "launched" confirmation immediately — no SSE stream.

**Streaming (agy only)**: worker emits newline-JSON events to stdout as today; the server route pipes them onto the SSE connection; the timeline appends each as it arrives.

**Approval round-trip**: on `permission_request`, the server route holds the worker's stdin open and renders the pending-approval card. Phone taps Approve/Deny → POST to the approve route → route writes `"approve"`/`"deny"` to the worker's stdin → worker resumes.

**Persistence**: transcripts append to a JSONL log per session (as today) for the sidebar's history and read-only replay — agy-streamer's own bookkeeping, in addition to (not instead of) the native `agy` conversation store now reachable via `conversation_id`.

## Error Handling

- **Worker crash mid-stream (agy)**: SSE emits a terminal `error` event; timeline shows "Session ended unexpectedly" instead of hanging; the JSONL transcript still has everything up to the crash.
- **Phone drops connection mid-stream**: SSE auto-reconnects (native browser behavior); the server route must replay from the transcript log on reconnect, not just resume from "now."
- **Approval card pending when connection drops**: the worker just blocks on stdin indefinitely — nothing times out. On reconnect, the same pending card re-renders (state lives in the JSONL log / the worker's still-blocked state, not in the SSE connection).
- **Claude/Codex CLI fails to spawn** (bad directory, tool not installed, etc.): surfaced as an immediate error toast/card, not a silent "launched" that never actually launched.

## Testing

Pragmatic scope for a single-user internal tool: unit tests for the `SessionBackend` implementations (mock the subprocess boundary, assert correct spawn args and event parsing) and the SSE reconnect/replay logic — the parts most likely to silently break. No e2e/browser test suite; not worth the maintenance here.

## Migration & Nx Specifics

- New Nx app at `apps/agy-streamer`. `@nx/vite/plugin` is already registered in `nx.json` and will auto-infer build/serve/preview/typecheck targets from the existing `vite.config.ts`.
- **TypeScript**: bump the workspace catalog (`pnpm-workspace.yaml`) from `5.9.3` to `6.0.3` (confirmed latest stable; TypeScript 7 is currently only dated dev-nightlies, not viable). This is a workspace-wide bump, not scoped to just this app — affects every project on `catalog:`.
- **Theming**: port `libs/rainforest-ui/src/tailwindcss/shadcn.ts` from PR #236 now (it's self-contained, no other dependencies from that PR) rather than wait for it to merge — check PR state first in case it's landed by the time of implementation.
- **Backend**: `agent_worker.py` (and its `uv`-managed Python env) travels with the app as a sibling resource, wrapped via an `nx:run-commands` target (e.g. `uv sync`, `uv run pytest`) — no Python Nx plugin needed, since it's invoked as a subprocess, not run as an Nx-orchestrated build step.
- **Left behind, not migrated**: `server.py`, `static/`, `scratch/`, `test_worker.py`, `redesigned_stitch_ui.html` — confirmed superseded/dead code and design-export debris.
- **Compatibility already confirmed**: React 19.2, Tailwind v4, ES2022 target, and strict-mode TS flags (`noUnusedLocals`, `noUnusedParameters`) already match this workspace's catalog/conventions.
