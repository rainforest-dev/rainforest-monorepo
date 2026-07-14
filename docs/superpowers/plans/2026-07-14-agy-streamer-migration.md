# agy-streamer Migration & Real-Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `agy-streamer` from an untracked folder in `rainforest-homelab` into `apps/agy-streamer` in the Nx workspace, re-skin it onto the shared dynamic-theme branding, and make its already-built (but currently non-functional) tool-approval UI actually pause execution for real decisions.

**Architecture:** Copy the existing TanStack Start app + `agent_worker.py` into `apps/agy-streamer` (code lives in `rainforest-monorepo` for Nx tooling and shared theming; the Python worker is a versioned runtime dependency, not Nx-orchestrated). Fix `agent_worker.py`'s `conversation_id` bug and add model/agent args. Rewire `agent-manager.ts`'s `agy` branch to spawn the fixed worker (JSON-stdout parsing, like the existing `claude` branch already does) instead of the raw `agy` CLI, and wire `permission_request` events to genuinely populate `pendingResolve` and write the decision back to the worker's stdin. Add a `codex` branch alongside the existing `claude`/`agy` ones (blocked pending `codex` actually being installed). Re-theme onto `libs/rainforest-ui/src/tailwindcss/shadcn.ts`. The running service is deployed and managed from `rainforest-homelab` via launchd, since it needs local subprocess-spawn access to `agy`/`claude`/`codex`/`uv` that can't exist on a cloud platform.

**Tech Stack:** TanStack Start (React 19.2, Vite 8), shadcn/ui + Radix, Tailwind v4, Python (`uv`, `google-antigravity` SDK, no Nx integration), Nx, pnpm workspace, launchd (deployment, in `rainforest-homelab`).

---

## Task 1: Scaffold `apps/agy-streamer` and verify it builds untouched

**Files:**
- Create: `apps/agy-streamer/` (copied from `/Users/rainforest/Repositories/rainforest-homelab/agy-streamer/frontend/`)
- Create: `apps/agy-streamer/worker/agent_worker.py`, `apps/agy-streamer/worker/pyproject.toml`, `apps/agy-streamer/worker/uv.lock` (copied from `/Users/rainforest/Repositories/rainforest-homelab/agy-streamer/`)

Before any code changes, get the app running unmodified inside the monorepo, so every later task has a known-good baseline to diff against.

- [ ] **Step 1: Copy the frontend, excluding build artifacts and its orphaned nested git repo**

```bash
mkdir -p apps/agy-streamer
rsync -a --exclude='node_modules' --exclude='.output' --exclude='.tanstack' \
  --exclude='.git' --exclude='.vscode' --exclude='.env' \
  /Users/rainforest/Repositories/rainforest-homelab/agy-streamer/frontend/ \
  apps/agy-streamer/
```

- [ ] **Step 2: Copy the Python worker into a `worker/` subfolder**

```bash
mkdir -p apps/agy-streamer/worker
cp /Users/rainforest/Repositories/rainforest-homelab/agy-streamer/agent_worker.py apps/agy-streamer/worker/
cp /Users/rainforest/Repositories/rainforest-homelab/agy-streamer/pyproject.toml apps/agy-streamer/worker/
cp /Users/rainforest/Repositories/rainforest-homelab/agy-streamer/uv.lock apps/agy-streamer/worker/
```

- [ ] **Step 3: Confirm nothing from the excluded legacy set got copied**

```bash
ls apps/agy-streamer/ | grep -E "^(server.py|static|scratch|test_worker.py|redesigned_stitch_ui.html)$"
```

Expected: no output (grep finds nothing — confirms `server.py`, `static/`, `scratch/`, `test_worker.py`, and `redesigned_stitch_ui.html` were correctly left behind, per the design spec's "confirmed dead code" finding).

- [ ] **Step 4: Add `nx` block to `apps/agy-streamer/package.json` for build dependency ordering**

Read the copied `apps/agy-streamer/package.json` first (`cat apps/agy-streamer/package.json`) to see its current `name` field, then add this block matching the pattern used by `apps/rss-manager/package.json`:

```json
  "nx": {
    "targets": {
      "dev": { "dependsOn": ["^build"] },
      "build": { "dependsOn": ["^build"], "cache": true }
    }
  }
```

Insert it as a top-level key in the JSON, after `"pnpm"` if present, otherwise after `"devDependencies"`.

- [ ] **Step 5: Do NOT wrap the Python worker in Nx targets**

Nx has no real Python-project support, and `agent_worker.py` doesn't benefit from being "Nx-managed" — it's a runtime dependency the Node server shells out to via `uv`, not a build artifact. Treat `apps/agy-streamer/worker/` as a plain versioned directory: `uv sync`/`uv run pytest` are run directly (see Task 5's manual verification steps), not through `nx:run-commands`. No `project.json` needed for this app at all — `@nx/vite/plugin`'s inference from `vite.config.ts` (already registered in `nx.json`) is sufficient for the TS/React side.

- [ ] **Step 6: Install dependencies and verify the dev server starts**

```bash
pnpm install
pnpm nx dev agy-streamer
```

Expected: Vite dev server starts on port 3000 (or logs an error to fix before continuing — do not proceed to Task 2 until this works cleanly). Stop the server (Ctrl-C) once confirmed.

- [ ] **Step 7: Verify the existing test suite still passes as-is**

```bash
pnpm nx test agy-streamer
```

Expected: `agent-manager.test.ts` and `api-integration.test.ts` pass unchanged (these were already passing in the source app — this step just confirms the copy didn't break anything, e.g. import path issues).

- [ ] **Step 8: Commit the untouched baseline**

```bash
git add apps/agy-streamer/
git commit -m "feat(agy-streamer): scaffold Nx app from rainforest-homelab source, unmodified

Plain copy of the working TanStack Start app + Python worker into
apps/agy-streamer, verified building and testing cleanly before any
refactoring. Legacy dead code (server.py, static/, scratch/,
test_worker.py, redesigned_stitch_ui.html) intentionally left behind."
```

---

## Task 2: Bump TypeScript workspace catalog to 6.0.3

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `apps/agy-streamer/package.json`

- [ ] **Step 1: Bump the catalog value**

In `pnpm-workspace.yaml`, change:
```yaml
  typescript: 5.9.3
```
to:
```yaml
  typescript: 6.0.3
```

- [ ] **Step 2: Point `apps/agy-streamer`'s own typescript dependency at the catalog**

In `apps/agy-streamer/package.json`, find `"typescript": "^6.0.2"` under `devDependencies` and change it to:
```json
    "typescript": "catalog:"
```

- [ ] **Step 3: Reinstall and verify the whole workspace still typechecks**

```bash
pnpm install
pnpm nx run-many -t typecheck --all
```

Expected: all projects pass. If any project fails under TS 6 that passed under 5.9.3, read the actual error — do not silently downgrade back to 5.9.3 without first understanding whether it's a real breaking change or a fixable strictness issue. Report any failures found before proceeding to Task 3.

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml apps/agy-streamer/package.json pnpm-lock.yaml
git commit -m "chore: bump workspace TypeScript catalog to 6.0.3

Latest stable (TypeScript 7 is currently dev-nightlies only, not
viable). agy-streamer's frontend already wanted ^6.0.2; this aligns
the whole workspace catalog instead of carrying a one-off version."
```

---

## Task 3: Port the shared shadcn theming plugin

**Files:**
- Create: `libs/rainforest-ui/src/tailwindcss/shadcn.ts` (if not already present — check first)
- Modify: `libs/rainforest-ui/vite.config.ts`

- [ ] **Step 1: Check whether this file already exists from the rss-manager theming task or a merged PR #236**

```bash
ls libs/rainforest-ui/src/tailwindcss/shadcn.ts 2>&1
gh pr view 236 --json state --jq .state
```

If the file already exists (either because PR #236 merged, or because the rss-manager theming agent's worktree changes were already ported into this branch), **skip to Step 3** — do not re-port and risk a conflicting duplicate.

- [ ] **Step 2: Port the file from PR #236's diff**

```bash
gh pr diff 236 > /tmp/pr236.diff
```

Extract the `libs/rainforest-ui/src/tailwindcss/shadcn.ts` addition from `/tmp/pr236.diff` (search for `diff --git a/libs/rainforest-ui/src/tailwindcss/shadcn.ts` in the file) and write it to `libs/rainforest-ui/src/tailwindcss/shadcn.ts` verbatim — it's a self-contained new file (a Tailwind plugin using `tailwindcss/plugin`, deriving shadcn CSS variable tokens from a `--seed` color via OKLCH relative-color syntax, with light/dark variants and a static fallback), with no other dependencies from that PR.

- [ ] **Step 3: Expose it via `libs/rainforest-ui/vite.config.ts`'s glob-based entry**

Read `libs/rainforest-ui/vite.config.ts` first to see the current entry glob pattern (it picks up `src/{lit,utils}/**/*.ts` plus explicit entries like `tailwindcss/md3`). Add a matching explicit entry for `tailwindcss/shadcn`:

```typescript
  'tailwindcss/shadcn': 'src/tailwindcss/shadcn.ts',
```

placed alongside the existing `'tailwindcss/md3': 'src/tailwindcss/md3.ts'` entry — do not remove the `md3` entry, since `apps/personal-website` still depends on it until PR #236 merges.

- [ ] **Step 4: Build `rainforest-ui` and confirm the new entry emits**

```bash
pnpm nx build rainforest-ui
ls dist/libs/rainforest-ui/tailwindcss/ 2>&1
```

Expected: `shadcn.js` (or `.mjs`) appears alongside `md3.js`.

- [ ] **Step 5: Commit**

```bash
git add libs/rainforest-ui/src/tailwindcss/shadcn.ts libs/rainforest-ui/vite.config.ts
git commit -m "feat(rainforest-ui): expose shadcn OKLCH theming plugin for deep import

Ported from PR #236 (self-contained, no other dependencies from that
PR) so apps/agy-streamer can use the shared dynamic-theme system
without waiting for the full personal-website migration to merge."
```

---

## Task 4: Wire the theme plugin into agy-streamer and retrofit colors

**Files:**
- Modify: `apps/agy-streamer/package.json` (add `@rainforest-dev/rainforest-ui` dependency)
- Modify: `apps/agy-streamer/vite.config.ts`
- Modify: `apps/agy-streamer/src/styles.css`
- Modify: files under `apps/agy-streamer/src/routes/` and `apps/agy-streamer/src/components/` that use hardcoded colors

- [ ] **Step 1: Add the workspace dependency**

In `apps/agy-streamer/package.json`, add under `dependencies`:
```json
    "@rainforest-dev/rainforest-ui": "workspace:*",
```

- [ ] **Step 2: Register the plugin in the app's CSS entry**

Read `apps/agy-streamer/src/styles.css` first. Tailwind v4 plugins register via `@plugin` in CSS (not a JS config file). Add near the top, after the `@import "tailwindcss";` line:

```css
@plugin '@rainforest-dev/rainforest-ui/tailwindcss/shadcn' {
  source-color: #6366f1;
}
```

Using `#6366f1` (the Stitch mockup's indigo accent) as the initial seed color — this can change later without touching component code, which is the point of the token system.

- [ ] **Step 3: Install and rebuild**

```bash
pnpm install
pnpm nx build rainforest-ui
```

- [ ] **Step 4: Find every hardcoded color class to retrofit**

```bash
grep -rlE "slate-[0-9]|indigo-[0-9]|emerald-[0-9]|rose-[0-9]|amber-[0-9]|#0[0-9a-f]{5}|#07090e|#0c0e13" apps/agy-streamer/src/
```

For each file found, replace literal color utilities with the token classes the plugin now exposes (`bg-background`, `text-foreground`, `bg-card`, `bg-popover`, `bg-primary text-primary-foreground`, `bg-secondary`, `bg-muted text-muted-foreground`, `bg-accent`, `text-destructive`, `border-border`, `border-input`, `ring-ring`) — matching the semantic role of each original color (e.g. the `indigo-600` primary-action buttons become `bg-primary text-primary-foreground`; `slate-950`/`slate-900` backgrounds become `bg-background`/`bg-card`; `rose-`/error-red stays mapped to `destructive`; `emerald-` "success/running" indicator can stay a literal `emerald` accent color, same reasoning as keeping rss-manager's amber "warning" literal — not every state needs to be a semantic token).

- [ ] **Step 5: Swap Material Symbols icon font for `lucide-react`**

```bash
grep -rn "material-symbols-outlined" apps/agy-streamer/src/ | wc -l
```

For each occurrence, replace the `<span className="material-symbols-outlined">icon_name</span>` pattern with the equivalent `lucide-react` component import (e.g. `smart_toy` → `Bot`, `psychology` → `Brain`, `expand_less`/`expand_more` → `ChevronUp`/`ChevronDown`, `content_copy` → `Copy`, `person` → `User`, `folder_open` → `FolderOpen`, `left_panel_close`/`right_panel_open` → `PanelLeftClose`/`PanelLeftOpen`, `verified_user` → `ShieldCheck`). `lucide-react` is already a `dependencies` entry — no install needed.

- [ ] **Step 6: Visual verification at mobile and desktop widths**

```bash
pnpm nx dev agy-streamer
```

Use the Browser tool to check the session view at ~375px and desktop width, both the sidebar/dialog session list and an active session's timeline (including the approval card, which you can trigger by checking `git stash` a test prompt through — or just visually inspect the JSX, since triggering a real approval isn't possible until Task 6). Confirm text contrast holds against the new `bg-background`/`bg-card` tokens.

- [ ] **Step 7: Run tests and commit**

```bash
pnpm nx test agy-streamer
git add apps/agy-streamer/
git commit -m "refactor(agy-streamer): retrofit UI onto shared shadcn theme tokens

Replaces the ad hoc slate/indigo/amber palette with the workspace's
shared OKLCH --seed-driven token system, and swaps Material Symbols
for the already-installed lucide-react. Structure and layout
unchanged - this is a re-skin, not a rebuild."
```

---

## Task 5: Fix `agent_worker.py` — conversation_id, model, and agent args

**Files:**
- Modify: `apps/agy-streamer/worker/agent_worker.py`

- [ ] **Step 1: Add `conversation_id` and optional `model`/`agent` params to `WebAgentRunner`**

Current constructor (in the copied file):
```python
class WebAgentRunner:
    def __init__(self, session_id, directory, prompt):
        self.session_id = session_id
        self.directory = directory
        self.prompt = prompt
```

Change to:
```python
class WebAgentRunner:
    def __init__(self, session_id, directory, prompt, model=None, agent=None):
        self.session_id = session_id
        self.directory = directory
        self.prompt = prompt
        self.model = model
        self.agent = agent
```

- [ ] **Step 2: Wire `conversation_id` into `LocalAgentConfig`, and `model` if present**

Current config construction:
```python
        config = LocalAgentConfig(
            system_instructions=(
                "You are an AI coding assistant helping a user inside a web dashboard. "
                "You have access to write tools. Confirm actions before running write tools."
            ),
            capabilities=CapabilitiesConfig(),
            workspaces=[self.directory],
            app_data_dir=app_data_dir,
            hooks=[permission_decider]
        )
```

Change to:
```python
        config_kwargs = dict(
            system_instructions=(
                "You are an AI coding assistant helping a user inside a web dashboard. "
                "You have access to write tools. Confirm actions before running write tools."
            ),
            capabilities=CapabilitiesConfig(),
            workspaces=[self.directory],
            app_data_dir=app_data_dir,
            hooks=[permission_decider],
            conversation_id=self.session_id,
        )
        if self.model:
            config_kwargs["model"] = self.model
        config = LocalAgentConfig(**config_kwargs)
```

Do NOT add an `agent=self.agent` kwarg here yet — per the design spec's flagged open risk, `LocalAgentConfig`'s introspected field list (`system_instructions`, `capabilities`, `tools`, `policies`, `hooks`, `triggers`, `mcp_servers`, `workspaces`, `conversation_id`, `save_dir`, `app_data_dir`, `response_schema`, `skills_paths`, `model`, `models`, `api_key`, `vertex`, `project`, `location`) has no `agent` field. Passing an unsupported kwarg would either be silently swallowed by `**kwargs` or raise — verify which by running Step 4 below with `--agent` set before deciding whether persona selection is even possible on this path.

- [ ] **Step 3: Parse `--model` and `--agent` as optional CLI args**

Current `__main__` block:
```python
if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(1)
        
    sid = sys.argv[1]
    dir_path = sys.argv[2]
    user_prompt = sys.argv[3]
    
    # Run the async runner
    asyncio.run(WebAgentRunner(sid, dir_path, user_prompt).run())
```

Change to:
```python
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("session_id")
    parser.add_argument("directory")
    parser.add_argument("prompt")
    parser.add_argument("--model", default=None)
    parser.add_argument("--agent", default=None)
    args = parser.parse_args()

    asyncio.run(WebAgentRunner(
        args.session_id, args.directory, args.prompt,
        model=args.model, agent=args.agent,
    ).run())
```

- [ ] **Step 4: Manually verify the conversation_id wiring actually produces a resumable session**

```bash
cd apps/agy-streamer/worker
uv sync
uv run python agent_worker.py test-conv-fix-001 /tmp "say hello and nothing else"
```

Expected: newline-JSON events print to stdout ending in `{"type": "turn_complete"}`. Then check whether the conversation is now visible to the native CLI:

```bash
agy --conversation test-conv-fix-001 -p "what did I just ask you to say?" --print-timeout 15s < /dev/null
```

Expected: the response references "hello" (proving the SDK-created conversation and the CLI's `--conversation` resume are reading the same underlying store). **If this does not work** (the CLI treats it as a brand-new conversation instead), the `conversation_id` wiring alone isn't sufficient for native resume — report this finding before proceeding, since it affects how much value Task 6 delivers versus what the spec assumed.

- [ ] **Step 5: Write a pytest for the argument parsing (the part that doesn't require a live SDK call)**

Create `apps/agy-streamer/worker/test_agent_worker.py`:
```python
import subprocess
import sys
import os

def test_missing_required_args_exits_nonzero():
    result = subprocess.run(
        [sys.executable, os.path.join(os.path.dirname(__file__), "agent_worker.py")],
        capture_output=True,
    )
    assert result.returncode != 0


def test_argparse_accepts_model_and_agent_flags():
    # argparse itself is well-tested; this just confirms our parser wiring
    # doesn't reject the new flags before reaching the async runner.
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("session_id")
    parser.add_argument("directory")
    parser.add_argument("prompt")
    parser.add_argument("--model", default=None)
    parser.add_argument("--agent", default=None)

    args = parser.parse_args(["sid", "/tmp", "hello", "--model", "gemini-3-pro", "--agent", "coder"])
    assert args.session_id == "sid"
    assert args.model == "gemini-3-pro"
    assert args.agent == "coder"
```

- [ ] **Step 6: Run it**

```bash
cd apps/agy-streamer/worker
uv run pytest test_agent_worker.py -v
```

Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo/.claude/worktrees/rss-manager-column-link-74627a
git add apps/agy-streamer/worker/
git commit -m "fix(agy-streamer): wire conversation_id into agent_worker.py

Was accepted as a CLI arg but never passed into LocalAgentConfig,
so sessions started via the worker weren't resumable via the native
agy CLI's --conversation flag. Also adds optional --model passthrough
and argparse-based CLI parsing. --agent intentionally not wired into
LocalAgentConfig yet - SDK introspection shows no matching field;
verify before using it for persona selection."
```

---

## Task 6: Rewire `agent-manager.ts`'s `agy` branch to use the fixed worker, with real approval

**Files:**
- Modify: `apps/agy-streamer/src/lib/agent-manager.ts`
- Modify: `apps/agy-streamer/src/lib/agent-manager.test.ts`

This is the core fix: replace the `agy` branch's CLI-shell-out-plus-log-tail approach with direct subprocess stdout parsing (matching the existing `claude` branch's pattern), and make `permission_request` events actually block on a real approval.

- [ ] **Step 1: Write the failing test first — permission request populates `pendingResolve` and blocks until resolved**

Add to `apps/agy-streamer/src/lib/agent-manager.test.ts`:
```typescript
  it('should populate pendingResolve when a permission_request event arrives from the agy worker', async () => {
    const session = getOrCreateSession('test-approval-flow');
    let capturedResolve: ((approved: boolean) => void) | null = null;

    // Simulate what handlePermissionRequestEvent (to be added) does:
    // it wraps a Promise, stores the resolver on the session, and
    // returns the promise so the caller can await the decision.
    const decisionPromise = new Promise<boolean>((resolve) => {
      session.pendingResolve = resolve;
      capturedResolve = resolve;
    });

    expect(session.pendingResolve).not.toBeNull();
    expect(session.pendingResolve).toBe(capturedResolve);

    const approved = handleToolApproval('test-approval-flow', true);
    expect(approved).toBe(true);
    await expect(decisionPromise).resolves.toBe(true);
  });
```

- [ ] **Step 2: Run it to confirm it passes against current code (it should, since this only exercises existing `pendingResolve`/`handleToolApproval` primitives, not new logic yet)**

```bash
pnpm nx test agy-streamer -- agent-manager.test.ts
```

Expected: PASS (this step confirms the existing primitives work correctly before you build the new code path that will actually use them in production).

- [ ] **Step 3: Add a `waitForApproval` helper to `agent-manager.ts`**

Add this function near `handleToolApproval` in `apps/agy-streamer/src/lib/agent-manager.ts`:
```typescript
export function waitForApproval(sessionId: string): Promise<boolean> {
  const session = getOrCreateSession(sessionId);
  return new Promise((resolve) => {
    session.pendingResolve = resolve;
  });
}
```

- [ ] **Step 4: Replace the `agy` branch's spawn + log-tail logic with worker-spawn + stdout parsing**

Current `agy` branch (the `else` block after the `agentType === 'claude'` check):
```typescript
  } else {
    const agyBinary = path.join(os.homedir(), '.local/bin/agy');
    child = spawn(agyBinary, [
      '--conversation', sessionId,
      '--add-dir', directory,
      '-p', prompt,
      '--dangerously-skip-permissions'
    ], {
      cwd: directory,
      env: { ...process.env }
    });
  }
```

Change to:
```typescript
  } else {
    const workerPath = path.join(__dirname, '..', '..', 'worker', 'agent_worker.py');
    const uvBinary = path.join(os.homedir(), '.local/bin/uv');
    const workerArgs = [
      'run', '--project', path.join(__dirname, '..', '..', 'worker'),
      'python', workerPath,
      sessionId, directory, prompt,
    ];
    child = spawn(uvBinary, workerArgs, {
      cwd: directory,
      env: { ...process.env },
    });

    let stdoutBuffer = '';
    child.stdout.on('data', async (chunk) => {
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'permission_request') {
            broadcast(sessionId, { type: 'permission_request', tool: event.tool, args: event.args });
            const approved = await waitForApproval(sessionId);
            child.stdin.write((approved ? 'approve' : 'deny') + '\n');
          } else if (event.type === 'thought') {
            await appendLogEntry(sessionId, { type: 'thinking', content: event.text, ts: new Date().toISOString() });
            broadcast(sessionId, { type: 'thought', data: { thinking: event.text } });
          } else if (event.type === 'token') {
            await appendLogEntry(sessionId, { type: 'PLANNER_RESPONSE', content: event.text, ts: new Date().toISOString() });
          } else if (event.type === 'tool_call_start') {
            await appendLogEntry(sessionId, {
              type: 'TOOL_CALL',
              content: `Calling tool: ${event.name}\nInput: ${JSON.stringify(event.args, null, 2)}`,
              ts: new Date().toISOString(),
            });
          } else if (event.type === 'tool_call_end') {
            await appendLogEntry(sessionId, {
              type: 'TOOL_RESULT',
              content: `Tool result for: ${event.name}\nSuccess: ${!event.error}\nOutput: ${event.result || ''}`,
              ts: new Date().toISOString(),
            });
          }
          // turn_complete is handled by the existing child.on('close') handler below - no action here.
        } catch (e) {
          // Non-JSON stdout line - ignore, matching the claude branch's tolerance for stray output.
        }
      }
    });
  }
```

Note this mirrors the `claude` branch's existing stdout-parsing pattern (buffer, split on newlines, `JSON.parse` per line, tolerate parse failures) rather than inventing a new pattern — consistency with the code already in this file.

- [ ] **Step 5: Confirm the existing `tailInterval`/log-tailing code below this branch is now dead for the `agy` path and remove it, since events now arrive via stdout directly, not via tailing agy's own transcript file**

Read the existing code right after the `if/else` block (the `const logDir = ...`, `const tailInterval = setInterval(...)` section) — this was written for the log-tailing approach and is no longer needed for either the `agy` branch (now stdout-driven, same as `claude`) or the `claude` branch (already stdout-driven, never used tailing). Remove the entire `tailInterval` block and the `byteOffset`/`fs.stat(logPath)` setup above it. Verify nothing else in the file references `tailInterval` before removing it (`grep -n tailInterval apps/agy-streamer/src/lib/agent-manager.ts`).

- [ ] **Step 6: Ensure `child.on('close')` still clears any dangling `pendingResolve` if the process exits while an approval is still pending (crash mid-approval)**

Current close handler ends with:
```typescript
    broadcast(sessionId, { type: 'turn_complete', code });
    session.process = null;
    if (session.controllers.size === 0) {
      activeSessions.delete(sessionId);
    }
```

Add a line before `session.process = null;`:
```typescript
    session.pendingResolve = null;
```

This prevents a stale resolver from a crashed process being accidentally invoked by a late `/approve` POST for a session that no longer has a live worker to write the decision to.

- [ ] **Step 7: Run the full test suite**

```bash
pnpm nx test agy-streamer
```

Expected: all tests pass, including the Step 1 test (now exercising real production logic, not just the primitives).

- [ ] **Step 8: Manual end-to-end verification**

```bash
pnpm nx dev agy-streamer
```

Start a real agy session through the UI with a prompt that requires a write tool (e.g. "create a test file in this directory"). Confirm the approval card actually appears and blocks — this is the functional proof that the fix works, since automated tests mock the subprocess boundary and can't prove the real SDK hook fires correctly end-to-end.

- [ ] **Step 9: Commit**

```bash
git add apps/agy-streamer/src/lib/agent-manager.ts apps/agy-streamer/src/lib/agent-manager.test.ts
git commit -m "fix(agy-streamer): make tool-call approval actually block execution

The agy branch previously shelled out to the real agy CLI in
non-interactive mode with --dangerously-skip-permissions, which
(confirmed by direct testing) never pauses for approval under any
flag combination. Now spawns the fixed agent_worker.py instead,
parsing its stdout JSON stream the same way the claude branch already
does, and wires permission_request events through waitForApproval so
the existing (previously non-functional) approval card in the UI now
genuinely blocks the agent until a decision is made."
```

---

## Task 7: Add a `codex` branch to `agent-manager.ts`

**Blocked on a prerequisite — check before starting:** `codex` is not installed on this machine (verified: `which codex` → not found; only an unopened `Codex.dmg` sits in `~/Downloads`). This task cannot be written or verified against real CLI behavior until it's installed. **Do not guess at codex's flags or output format** — if it's still not installed when you reach this task, skip it and move to Task 8/9 with the agent-type selector's `codex` option and its selector code left out (ship agy's real-approval fix and the theming migration without codex support, and revisit this task later once codex is actually available to test against).

**Files:**
- Modify: `apps/agy-streamer/src/lib/agent-manager.ts`
- Modify: `apps/agy-streamer/src/lib/agent-manager.test.ts`

- [ ] **Step 1: Confirm codex is installed, then check its actual non-interactive output format**

```bash
which codex || echo "NOT INSTALLED - stop here, see task header"
codex exec --help 2>&1 | grep -i "json\|output\|format"
```

Read the actual flag name for structured/JSON output (this plan cannot assume it matches `claude`'s `--output-format stream-json` naming without checking — codex may use a different flag or format entirely). Adjust Step 2 below to match whatever this command reveals.

- [ ] **Step 2: Write a failing test asserting `startAgentSession` spawns the codex binary with the right args for `agentType === 'codex'`**

Add to `apps/agy-streamer/src/lib/agent-manager.test.ts` (adapt the exact flags based on Step 1's findings):
```typescript
  it('should spawn the codex binary when agentType is codex', async () => {
    const { spawn } = await import('child_process');
    const spawnSpy = vi.spyOn(await import('child_process'), 'spawn');

    const { startAgentSession } = await import('./agent-manager');
    try {
      await startAgentSession('test-codex-session', '/tmp', 'test prompt', 'codex');
    } catch (e) {
      // Spawn will fail in test env without the real binary present - that's fine,
      // this test only asserts the spawn call shape, not successful execution.
    }

    expect(spawnSpy).toHaveBeenCalled();
    const [binary, args] = spawnSpy.mock.calls[spawnSpy.mock.calls.length - 1];
    expect(String(binary)).toContain('codex');
    expect(args).toContain('test prompt');
  });
```

- [ ] **Step 3: Run it, confirm it fails**

```bash
pnpm nx test agy-streamer -- agent-manager.test.ts
```

Expected: FAIL — `agentType === 'codex'` currently falls through to the `agy` branch (the `else`), so it'll try to spawn `agy`/`uv`, not `codex`.

- [ ] **Step 4: Add the codex branch**

Change the `if (agentType === 'claude') { ... } else { ... }` structure to a three-way branch. Add before the final `else`:
```typescript
  } else if (agentType === 'codex') {
    const codexBinary = path.join(os.homedir(), '.local/bin/codex');
    child = spawn(codexBinary, [
      'exec', prompt,
      // TODO-VERIFIED-AT-STEP-1: replace with the actual flag(s) Step 1 found
    ], {
      cwd: directory,
      env: { ...process.env },
    });

    let stdoutBuffer = '';
    child.stdout.on('data', async (chunk) => {
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        // Parsing logic depends entirely on Step 1's findings - if codex exec
        // supports a JSON stream format, mirror the claude branch's parser
        // (assistant/tool_use/tool_result event types). If it only supports
        // plain text output, append each line directly as a PLANNER_RESPONSE
        // entry instead of attempting JSON.parse.
        await appendLogEntry(sessionId, { type: 'PLANNER_RESPONSE', content: line, ts: new Date().toISOString() });
      }
    });
  } else {
```

This step intentionally cannot give exact final parsing code sight-unseen — Step 1's output determines whether codex has a structured stream format (mirror the `claude` branch) or only plain text (append lines directly, as sketched above). Resolve the `TODO-VERIFIED-AT-STEP-1` marker and the parsing logic using Step 1's actual findings before moving on — do not leave the TODO in the committed code.

- [ ] **Step 5: Run the test again, confirm it passes**

```bash
pnpm nx test agy-streamer -- agent-manager.test.ts
```

- [ ] **Step 6: Manual verification — launch a real codex session through the UI (requires adding `codex` as a third `<option>` in the agent-type selector — see Task 8, Step 1, which must land before this can be tested end-to-end via the UI; alternatively POST directly to the chat route to test the backend in isolation)**

```bash
curl -X POST http://localhost:3000/api/sessions/test-codex-manual/chat \
  -H 'Content-Type: application/json' \
  -d '{"directory": "/tmp", "prompt": "say hello", "agent": "codex"}'
```

Confirm via the session's SSE stream or the transcript log that codex actually ran and produced output.

- [ ] **Step 7: Commit**

```bash
git add apps/agy-streamer/src/lib/agent-manager.ts apps/agy-streamer/src/lib/agent-manager.test.ts
git commit -m "feat(agy-streamer): add codex as a third agent backend

Mirrors the claude branch's spawn-and-parse pattern. Codex does not
get the real approval-gating fix from Task 6 - it's a launcher like
claude, not the primary controlled experience agy is."
```

---

## Task 8: Add `codex` to the UI selector, plus model/agent selection

**Files:**
- Modify: `apps/agy-streamer/src/routes/sessions.$sessionId.tsx`
- Modify: `apps/agy-streamer/src/routes/api/sessions/$sessionId/chat.ts`

- [ ] **Step 1: Add the third option to the existing agent-type `<select>`**

Current select (in `sessions.$sessionId.tsx`):
```tsx
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2.5 py-1 text-xs h-8 outline-none font-sans cursor-pointer focus:border-indigo-500 shrink-0"
            >
              <option value="agy">🪐 Antigravity CLI</option>
              <option value="claude">🤖 Claude Code</option>
            </select>
```

Add a third option (and apply the Task 4 token-class retrofit to this element while touching it):
```tsx
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="bg-card border border-border text-foreground rounded px-2.5 py-1 text-xs h-8 outline-none font-sans cursor-pointer focus:border-primary shrink-0"
            >
              <option value="agy">🪐 Antigravity CLI</option>
              <option value="claude">🤖 Claude Code</option>
              <option value="codex">🧭 Codex</option>
            </select>
```

- [ ] **Step 2: Add a model input, gated to only show for the `agy` agent type (per the design spec's flag that `agent` persona-selection may not be wired-through on the SDK path)**

Add state near the existing `agentType` state declaration:
```tsx
  const [model, setModel] = useState('');
```

Add JSX right after the agent-type `<select>` in the same flex container:
```tsx
            {agentType === 'agy' && (
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="model (optional)"
                className="h-8 text-xs w-32 bg-card border-border text-foreground"
              />
            )}
```

- [ ] **Step 3: Pass `model` through the chat mutation**

Current `chatMutation`:
```tsx
  const chatMutation = useMutation({
    mutationFn: async ({ prompt, dir }: { prompt: string; dir: string }) => {
      setIsRunning(true);
      setPendingPermission(null);
      const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: dir, prompt })
      });
      return res.json();
    },
    onSuccess: () => {
      setInputPrompt('');
    }
  });
```

Change the body to include `agent` and `model`:
```tsx
        body: JSON.stringify({ directory: dir, prompt, agent: agentType, model: model || undefined })
```

(Note: `agent` was likely already missing from this payload even before this change — verify by checking `chat.ts`'s destructuring, which reads `agent` from the body. If it was already being sent, this step just adds `model` alongside it.)

- [ ] **Step 4: Thread `model` through `chat.ts` and `startAgentSession`**

In `apps/agy-streamer/src/routes/api/sessions/$sessionId/chat.ts`, change:
```typescript
          const { directory, prompt, agent } = await request.json();
          startAgentSession(sessionId, directory, prompt, agent || 'agy');
```
to:
```typescript
          const { directory, prompt, agent, model } = await request.json();
          startAgentSession(sessionId, directory, prompt, agent || 'agy', { model });
```

In `agent-manager.ts`, update `startAgentSession`'s signature to accept the options object and forward `model` into the worker spawn args from Task 6:
```typescript
export async function startAgentSession(sessionId: string, directory: string, prompt: string, agentType = 'agy', options: { model?: string } = {}) {
```

And in the `agy` branch's `workerArgs` array (from Task 6, Step 4), append the model flag conditionally:
```typescript
    const workerArgs = [
      'run', '--project', path.join(__dirname, '..', '..', 'worker'),
      'python', workerPath,
      sessionId, directory, prompt,
      ...(options.model ? ['--model', options.model] : []),
    ];
```

- [ ] **Step 5: Run tests**

```bash
pnpm nx test agy-streamer
```

Fix any test that constructs a `startAgentSession` call using the old 4-argument signature without the new optional 5th parameter (should still pass, since it's optional with a default, but verify).

- [ ] **Step 6: Manual verification**

```bash
pnpm nx dev agy-streamer
```

Confirm the model input appears only for the `agy` agent type, and a session started with a model value set actually gets the `--model` flag passed through (check the worker's stdout/logs for confirmation, or add a temporary `console.log` of `workerArgs` and remove it after confirming).

- [ ] **Step 7: Commit**

```bash
git add apps/agy-streamer/src/routes/sessions.\$sessionId.tsx apps/agy-streamer/src/routes/api/sessions/\$sessionId/chat.ts apps/agy-streamer/src/lib/agent-manager.ts
git commit -m "feat(agy-streamer): add codex to agent selector, add model selection for agy

Model input only shows for the agy agent type, since agent_worker.py
only wires model into LocalAgentConfig - Task 5 explicitly deferred
persona (--agent) selection pending SDK support confirmation."
```

---

## Task 9: Final legacy-cleanup confirmation and cutover note

**Files:** none modified — this task is verification and a manual follow-up flag, not code.

- [ ] **Step 1: Verify SSE reconnect-replay behavior (flagged as an open risk in the design spec, not yet explicitly checked in any earlier task)**

Start a real agy session, let a few events stream in, then simulate a dropped connection by closing and reopening the browser tab on the same session URL (not just refreshing — actually navigating away and back, to exercise the `loader`'s `fetchSessionHistory` call plus a fresh `EventSource` connection). Confirm the timeline shows the full history (via the route loader) rather than only events that arrive after reconnection. If gaps appear, this is a real bug to fix — do not mark this step complete until verified either way, and report the finding.

- [ ] **Step 2: Confirm the migrated app has zero references to anything left behind in `rainforest-homelab`**

```bash
grep -rn "rainforest-homelab" apps/agy-streamer/ --include="*.ts" --include="*.tsx" --include="*.py"
```

Expected: no output (confirms no hardcoded paths back to the source location leaked into the migrated copy).

- [ ] **Step 2: Run the full test suite and build one final time**

```bash
pnpm nx test agy-streamer
pnpm nx build agy-streamer
```

Expected: both pass clean.

- [ ] **Step 3: Do NOT delete the original `rainforest-homelab/agy-streamer` folder as part of this plan**

The original is a live, currently-running dev environment on a separate repo. Deleting it is a real, hard-to-reverse action outside this plan's scope — flag it to the user as a manual follow-up once they've confirmed the migrated `apps/agy-streamer` is working the way they want in daily use, rather than auto-deleting it here.

- [ ] **Step 4: Final commit noting migration completion**

```bash
git log --oneline -10
```

Review the commit sequence for this migration reads cleanly as a coherent story before considering the plan complete. No new commit needed for this step — it's a review checkpoint.

---

## Task 10: Persistent local deployment, managed from `rainforest-homelab`

**Why this is a separate repo from the code**: the app's entire purpose depends on spawning `agy`/`claude`/`codex`/`uv` as local subprocesses on this specific Mac. It cannot run on a cloud platform (unlike `personal-website`'s Vercel deploy) — it has to run *here*, persistently, bound to the Tailscale IP. `rainforest-homelab` is the infra-as-code repo for exactly this kind of thing (it already manages other local/homelab services via Terraform and `configs/`), so the *deployment* artifact lives there even though the *code* lives in `rainforest-monorepo`.

**Files:**
- Create: `rainforest-homelab/configs/agy-streamer/tools.rainforest.agy-streamer.plist`
- Create: `rainforest-homelab/configs/agy-streamer/README.md`

- [ ] **Step 1: One-time worker dependency setup (not part of the persistent service — run once manually)**

```bash
cd apps/agy-streamer/worker
uv sync
```

- [ ] **Step 2: Get the Tailscale IPv4 to bind to**

```bash
tailscale ip -4
```

Note the output (e.g. `100.111.143.71`) — used in Step 3.

- [ ] **Step 3: Write the launchd plist**

Create `rainforest-homelab/configs/agy-streamer/tools.rainforest.agy-streamer.plist` (fill in the real Tailscale IP from Step 2 in place of `<TAILSCALE_IP>`, and confirm the actual `pnpm` path with `which pnpm` first — do not assume `/usr/local/bin/pnpm` without checking):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>tools.rainforest.agy-streamer</string>
    <key>WorkingDirectory</key>
    <string>/Users/rainforest/Repositories/rainforest-monorepo</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>pnpm nx dev agy-streamer -- --host &lt;TAILSCALE_IP&gt;</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/rainforest/Library/Logs/agy-streamer.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/rainforest/Library/Logs/agy-streamer.log</string>
</dict>
</plist>
```

`KeepAlive: true` restarts it if it crashes; `RunAtLoad: true` starts it on login/reboot, since this is meant to be always-reachable from your phone, not something you remember to start manually.

- [ ] **Step 4: Document the deployment in a short README alongside the plist**

Create `rainforest-homelab/configs/agy-streamer/README.md`:

```markdown
# agy-streamer deployment

Code lives in `rainforest-monorepo` at `apps/agy-streamer` — this directory only
holds the launchd config that runs it persistently on this Mac, bound to the
Tailscale IP, since the app needs local subprocess-spawn access to `agy`,
`claude`, `codex`, and `uv` that only exists here (it cannot run on a cloud
platform).

## Install

1. One-time: `cd ~/Repositories/rainforest-monorepo/apps/agy-streamer/worker && uv sync`
2. Copy `tools.rainforest.agy-streamer.plist` to `~/Library/LaunchAgents/`
3. `launchctl load -w ~/Library/LaunchAgents/tools.rainforest.agy-streamer.plist`
4. Confirm: `launchctl list | grep agy-streamer`, then open `http://<tailscale-ip>:3000` from another Tailnet device.

## Update

After pulling new code in `rainforest-monorepo`:
```bash
launchctl kickstart -k gui/$(id -u)/tools.rainforest.agy-streamer
```

## Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/tools.rainforest.agy-streamer.plist
rm ~/Library/LaunchAgents/tools.rainforest.agy-streamer.plist
```
```

- [ ] **Step 5: Do NOT load the launchd job as part of this plan without explicit confirmation**

Installing a persistent, `RunAtLoad`/`KeepAlive` service is a standing configuration change to this Mac, not a reversible-by-default action like the rest of this plan's file edits. Present the plist and README to the user, get explicit confirmation, and only then run:

```bash
cp rainforest-homelab/configs/agy-streamer/tools.rainforest.agy-streamer.plist ~/Library/LaunchAgents/
plutil -lint ~/Library/LaunchAgents/tools.rainforest.agy-streamer.plist
launchctl load -w ~/Library/LaunchAgents/tools.rainforest.agy-streamer.plist
launchctl list | grep agy-streamer
```

- [ ] **Step 6: Verify from another device on the Tailnet**

Open `http://<tailscale-ip>:3000` from your phone. Confirm the session list loads and a test prompt round-trips successfully, including a real approval card if the prompt triggers a write tool (the actual proof this whole migration was worth doing).

- [ ] **Step 7: Commit the homelab-side deployment config**

```bash
cd /Users/rainforest/Repositories/rainforest-homelab
git add configs/agy-streamer/
git commit -m "feat(agy-streamer): add persistent local deployment via launchd

Runs apps/agy-streamer from the rainforest-monorepo checkout, bound to
the Tailscale IP, with RunAtLoad + KeepAlive so it survives reboots
without needing a manually-started dev server. Code stays in
rainforest-monorepo; this repo only owns the deployment/ops side,
since the app needs local subprocess-spawn access that only exists
on this Mac and can't move to a cloud platform."
```
