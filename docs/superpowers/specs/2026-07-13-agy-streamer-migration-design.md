# agy-streamer: Nx Migration & Refinement — Design

> **Revision note**: this spec was originally written from the README alone and significantly underestimated what already exists. It's been rewritten after reading the actual `agent-manager.ts`, route handlers, `sessions.$sessionId.tsx`, and existing tests, plus empirically testing `agy`'s CLI permission behavior. See "Current State" below for what changed.

## Summary

`agy-streamer` currently lives as an untracked, uncommitted folder inside `rainforest-homelab` — a TanStack Start web app that lets you remotely drive agy and Claude Code sessions from your phone over Tailscale. It's considerably more built than it first appeared: agent-type switching, a full approval-card UI, directory browsing, and per-session history already work. This design migrates it into `rainforest-monorepo` as a proper Nx app, refines its UI onto the shared dynamic-theme branding, and fixes the one thing that's UI-complete but not functionally real: tool-call approval never actually pauses execution today, because both backends run through modes that always auto-proceed.

## Current State (corrected)

- **Frontend**: TanStack Start (React 19.2, Vite 8), shadcn/ui + Radix, Tailwind v4. Already implements: an agent-type `<select>` (Antigravity / Claude Code), a session sidebar (desktop) / dialog switcher (mobile) with per-type badges, a directory browser with recent-projects shortcuts, SSE-driven live timeline, and a fully-wired approval card (`pendingPermission` state → Approve/Deny → `/approve` route → `handleToolApproval`). Styled with an ad hoc slate/indigo/amber palette and Google Material Symbols icon font, despite `lucide-react` sitting unused in `package.json`.
- **`agent-manager.ts`** (`frontend/src/lib/agent-manager.ts`) is the real backend today. `startAgentSession(sessionId, directory, prompt, agentType)` branches:
  - `agentType === 'claude'`: spawns the real `claude` CLI binary directly (`--session-id <id> -p <prompt> --output-format stream-json --verbose --dangerously-skip-permissions`), parses its JSON stream, appends events to a JSONL transcript log, and polls/broadcasts.
  - default (`agy`): spawns the real `agy` CLI binary directly (`--conversation <id> --add-dir <directory> -p <prompt> --dangerously-skip-permissions`), then tails the transcript log `agy` itself writes to `~/.gemini/antigravity-cli/brain/<id>/.system_generated/logs/transcript.jsonl` and broadcasts new lines over SSE.
  - Neither path ever sets `session.pendingResolve` — `handleToolApproval` and the frontend's approval card are fully wired but functionally dead, because nothing in the live code path ever populates a pending approval.
- **`agent_worker.py`** (Python, `google-antigravity` SDK) is a *different, unused* implementation — never imported by any route. It's not dead weight to discard, though: it's the one piece that demonstrably supports real per-tool-call approval, via the SDK's `pre_tool_call_decide` hook, which genuinely blocks on stdin until a decision arrives (confirmed by reading it). Its one bug: it accepts a `session_id` argument but never passes it as `conversation_id` into `LocalAgentConfig` (which supports that field — confirmed via SDK introspection), so its sessions today wouldn't be resumable via the native `agy` CLI either.
- **Empirically confirmed**: `agy -p` (print/non-interactive mode) *never* pauses for approval, with or without `--dangerously-skip-permissions`, and regardless of `--mode plan` vs. default. Tested directly — a write-tool call executed immediately in both cases, exit 0, no prompt, no hang. This isn't a flag to discover; **non-interactive CLI mode has no human-in-the-loop mechanism at all.** The only verified path to genuine per-tool-call blocking is the Python SDK's hook system.
- **Legacy dead code, confirmed unused anywhere in the frontend** (grepped): `server.py` + `static/` (older FastAPI+WebSocket+vanilla-JS prototype), `scratch/`, `test_worker.py`, `redesigned_stitch_ui.html` (a Stitch design export, referenced only for visual inspiration, never wired to anything).
- **Git status**: the whole `agy-streamer/` folder is untracked in `rainforest-homelab`; `frontend/.git` is an orphaned nested repo from scaffolding, not a real submodule. No git history to preserve — migration is a plain file copy.
- **Existing test coverage to preserve**: `agent-manager.test.ts` (session lifecycle, SSE client management, approval promise resolution) and `api-integration.test.ts` (route-level, mocks `startAgentSession`).

## Goals

- Move the app into `apps/agy-streamer` in the Nx workspace, following existing conventions.
- Refine the UI onto the workspace's shared dynamic OKLCH `--seed` theming (`libs/rainforest-ui/src/tailwindcss/shadcn.ts`, from PR #236) and `lucide-react` icons, mobile-first — replacing the current ad hoc palette and Material Symbols, not the already-solid structure underneath.
- **Make approval real** for the `agy` backend: revive and fix `agent_worker.py` (wire `conversation_id`, add `model`/`agent` persona params), make `agent-manager.ts` spawn it instead of the raw CLI for the `agy` path, and wire `permission_request` events through to actually populate `pendingResolve` and write the decision back to the worker's stdin. This makes the existing approval UI functionally real for the first time.
- Add `model` and `agent` (persona) selection to the UI, backed by `agy --model` / `agy agents`.
- Add a third `codex` branch to `agent-manager.ts`, mirroring the `claude` branch's approach (spawn locally, parse its stream). Codex won't get real approval-gating (same non-interactive-mode limitation likely applies, unverified) — it's a launcher like Claude, not the primary controlled experience like agy.
- Keep `claude`/`codex` as-is functionally (already streaming into the same UI) — they don't need the approval fix, since Claude/Codex's own apps are the place for that; agy-streamer's job for them is convenience access from the phone, not being their primary approval surface.

## Non-Goals

- No zero-trust / network-level access control design — Tailscale already restricts network access.
- No production public-internet deployment — Tailscale-only personal tool.
- No attempt to make Claude/Codex sessions' approval flow "real" the way agy's is — out of scope; their own apps own that experience.

## Architecture

`agent-manager.ts` keeps its existing `startAgentSession(sessionId, directory, prompt, agentType, options)` shape (adding `model`/`agent` to `options`), but the `agy` branch changes from shelling out to the `agy` CLI binary to spawning `agent_worker.py` via `uv run`:

```
uv run python worker/agent_worker.py <sessionId> <directory> <prompt> [--model <model>] [--agent <agent>]
```

`agent_worker.py` gets two fixes: pass `conversation_id=session_id` into `LocalAgentConfig` (native resume compatibility), and accept optional `--model`/`--agent` CLI args forwarded into `LocalAgentConfig(model=..., agent=...)` (verify at implementation time whether the SDK actually exposes an `agent` field the way the `agy` CLI's `--agent` flag implies — if not, that specific piece may need to stay CLI-only and not extend to the SDK path).

`agent-manager.ts`'s stdout parser for the `agy` branch changes from log-tailing to direct JSON-line parsing of the worker's stdout (`thought`, `token`, `tool_call_start`, `tool_call_end`, `permission_request`, `turn_complete`) — same pattern already used for the `claude` branch. On `permission_request`, it creates a `Promise<boolean>`, stores the resolver in `session.pendingResolve`, and broadcasts the event over SSE (the frontend already handles `permission_request` — no frontend change needed here). `handleToolApproval` (already correct) resolves the promise; the manager then writes `"approve\n"` / `"deny\n"` to the worker's stdin.

The `claude` and `codex` branches are unaffected by this — they keep shelling out to the real CLIs directly, same as today, since real approval-gating isn't the goal for them.

**Open risk, to verify during implementation**: whether the Python SDK's `LocalAgentConfig` actually has an `agent` field for persona selection (only confirmed fields from introspection: `model`, `models` — no `agent`). If it doesn't, agent-persona selection may only be meaningful for the `claude`/`codex` CLI paths, not agy's SDK path.

## UI & Branding

Mobile-first, single column, adapting the existing structure rather than replacing it:
- The existing desktop sidebar / mobile dialog-based session switcher stays, restyled onto theme tokens.
- The existing approval card, timeline, directory browser, and agent-type selector all stay structurally — this is a re-skin plus the model/agent-selection addition, not a rebuild.
- Colors come from the shared `shadcn.ts` OKLCH `--seed` plugin instead of the current hardcoded slate/indigo/amber classes — consistent with personal-website's dynamic theming.
- Material Symbols icon font swapped for `lucide-react` (already an unused dependency).
- Add a `model`/`agent` selector next to the existing agent-type `<select>`, populated from `agy models` / `agy agents` output (or hardcoded common defaults if shelling out to list them per-request is too slow — verify at implementation time).

## Data Flow

**Starting a session (agy)**: phone submits `{directory, prompt, agentType: 'agy', model?, agent?}` → route calls `startAgentSession` → spawns `agent_worker.py` with `conversation_id=sessionId` → SSE stream opens keyed by sessionId → worker's stdout JSON events pipe through to the timeline exactly as today's `claude` branch already does.

**Approval round-trip (agy, now real)**: worker emits `permission_request` → manager stores `pendingResolve`, broadcasts to SSE → phone's existing approval card renders (already works) → Approve/Deny → POST `/approve` → `handleToolApproval` resolves the promise → manager writes decision to worker's stdin → worker resumes, continues emitting events.

**Claude/Codex**: unchanged from today's `claude` branch pattern — spawn, parse stdout stream, broadcast, no approval gating.

**Persistence**: JSONL transcript per session continues as today (already working, this is agy-streamer's own bookkeeping) in addition to the native `agy` conversation store now reachable via `conversation_id`.

## Error Handling

- **Worker crash mid-stream**: SSE emits a terminal `error` event (already implemented in `agent-manager.ts`'s `child.on('error')`/`child.on('close')` handlers) — no change needed, just confirm it still fires correctly once the `agy` branch spawns `agent_worker.py` instead of the CLI.
- **Phone drops connection mid-stream**: SSE auto-reconnects; verify the reconnect path replays from the transcript log (check current behavior — `fetchSessionHistory` server function already loads history on route load, so a full page reload recovers state; a bare SSE reconnect without reload may not — worth confirming during implementation).
- **Approval card pending when connection drops**: worker blocks on stdin indefinitely; nothing times out. This already matches the existing (currently-dead) approval design — no new work, just confirm it holds once approval is real.
- **Claude/Codex/agy_worker fails to spawn**: `child.on('error')` already broadcasts an `error` event — confirm this still surfaces clearly in the UI once `agy` goes through the worker path.

## Testing

- Port `agent-manager.test.ts` and `api-integration.test.ts` as-is (mock the subprocess boundary same as today).
- Add tests for the new `agy` branch's stdout-JSON parsing (mirroring however the existing `claude` branch parsing is tested, if it is — check first) and for the `permission_request` → `pendingResolve` → stdin-write round trip, since that's the genuinely new logic.
- No e2e/browser test suite — pragmatic scope for a single-user tool.

## Migration & Nx Specifics

- New Nx app at `apps/agy-streamer`. `@nx/vite/plugin` is already registered in `nx.json` and will auto-infer build/serve/preview/typecheck targets from the existing `vite.config.ts`.
- **TypeScript**: bump the workspace catalog (`pnpm-workspace.yaml`) from `5.9.3` to `6.0.3` (confirmed latest stable; TypeScript 7 is currently only dated dev-nightlies). Workspace-wide bump — verify `pnpm nx run-many -t typecheck` still passes across all projects after.
- **Theming**: port `libs/rainforest-ui/src/tailwindcss/shadcn.ts` from PR #236 (self-contained, no other dependencies from that PR) — check PR state first in case it's merged by implementation time. Note: the rss-manager theming task (dispatched separately) already did this exact port into a different worktree; check whether that can be reused instead of porting twice.
- **Backend**: `agent_worker.py` (fixed) and its `uv`-managed Python env travel with the app as a sibling `worker/` resource, wrapped via an `nx:run-commands` target for `uv sync` / `uv run pytest`.
- **Left behind, not migrated**: `server.py`, `static/`, `scratch/`, `test_worker.py`, `redesigned_stitch_ui.html` — confirmed dead/unused.
- **Compatibility already confirmed**: React 19.2, Tailwind v4, ES2022 target, and strict-mode TS flags already match this workspace's conventions.
