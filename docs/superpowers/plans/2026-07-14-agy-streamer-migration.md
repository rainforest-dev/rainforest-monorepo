# agy-streamer Migration & Real-Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `agy-streamer` from an untracked folder in `rainforest-homelab` into `apps/agy-streamer` in the Nx workspace, re-skin it onto the shared dynamic-theme branding, and make its already-built (but currently non-functional) tool-approval UI actually pause execution for real decisions.

**Architecture:** Copy the existing TanStack Start app into `apps/agy-streamer` (no Python at all — `agent_worker.py`/the SDK path is a confirmed dead end, requires a separate paid API key). Rewire `agent-manager.ts`'s `agy` branch from plain non-interactive `child_process.spawn` to `node-pty`-driven genuine interactive mode (`agy -i`), which is the only path confirmed to support real approval-gating, authenticated via the existing Google AI Pro OAuth session at no extra cost. A new parser (`agy-pty-parser.ts`) turns the raw ANSI-laden PTY output into structured menu-prompt events; `pendingResolve`/`handleToolApproval` widen from boolean to option-index to support the real 2-4-option prompts. Add a `codex` branch alongside the existing `claude`/`agy` ones (blocked pending `codex` actually being installed). Re-theme onto `libs/rainforest-ui/src/tailwindcss/shadcn.ts`. The running service is deployed and managed from `rainforest-homelab` via launchd, since it needs local PTY-spawn access to `agy`/`claude`/`codex` that can't exist on a cloud platform.

**Tech Stack:** TanStack Start (React 19.2, Vite 8), shadcn/ui + Radix, Tailwind v4, `node-pty` + `strip-ansi` (interactive CLI automation), Nx, pnpm workspace, launchd (deployment, in `rainforest-homelab`). No Python.

---

## Task 1: Scaffold `apps/agy-streamer` and verify it builds untouched

**Files:**
- Create: `apps/agy-streamer/` (copied from `/Users/rainforest/Repositories/rainforest-homelab/agy-streamer/frontend/`)

Before any code changes, get the app running unmodified inside the monorepo, so every later task has a known-good baseline to diff against. **No Python this time** — `agent_worker.py` is a confirmed dead end (requires a separate paid API key) and is not part of the migration at all; see the design spec's revision 2 note.

- [ ] **Step 1: Copy the frontend, excluding build artifacts and its orphaned nested git repo**

```bash
mkdir -p apps/agy-streamer
rsync -a --exclude='node_modules' --exclude='.output' --exclude='.tanstack' \
  --exclude='.git' --exclude='.vscode' --exclude='.env' \
  /Users/rainforest/Repositories/rainforest-homelab/agy-streamer/frontend/ \
  apps/agy-streamer/
```

- [ ] **Step 2: Confirm nothing from the excluded legacy set got copied**

```bash
ls apps/agy-streamer/ | grep -E "^(server.py|static|scratch|test_worker.py|redesigned_stitch_ui.html|agent_worker.py|pyproject.toml|uv.lock)$"
```

Expected: no output (grep finds nothing — confirms `server.py`, `static/`, `scratch/`, `test_worker.py`, `redesigned_stitch_ui.html`, and the Python worker files were correctly left behind).

- [ ] **Step 3: Add `nx` block to `apps/agy-streamer/package.json` for build dependency ordering**

Read the copied `apps/agy-streamer/package.json` first (`cat apps/agy-streamer/package.json`) to see its current `name` field, then add this block matching the pattern used by `apps/rss-manager/package.json`:

```json
  "nx": {
    "targets": {
      "dev": { "dependsOn": ["^build"] },
      "build": { "dependsOn": ["^build"], "cache": true }
    }
  }
```

Insert it as a top-level key in the JSON, after `"pnpm"` if present, otherwise after `"devDependencies"`. No `project.json` needed for this app — `@nx/vite/plugin`'s inference from `vite.config.ts` (already registered in `nx.json`) is sufficient.

- [ ] **Step 4: Install dependencies and verify the dev server starts**

```bash
pnpm install
pnpm nx dev agy-streamer
```

Expected: Vite dev server starts on port 3000 (or logs an error to fix before continuing — do not proceed to Task 2 until this works cleanly). Stop the server (Ctrl-C) once confirmed.

- [ ] **Step 5: Verify the existing test suite still passes as-is**

```bash
pnpm nx test agy-streamer
```

Expected: `agent-manager.test.ts` and `api-integration.test.ts` pass unchanged (these were already passing in the source app — this step just confirms the copy didn't break anything, e.g. import path issues).

- [ ] **Step 6: Commit the untouched baseline**

```bash
git add apps/agy-streamer/
git commit -m "feat(agy-streamer): scaffold Nx app from rainforest-homelab source, unmodified

Plain copy of the working TanStack Start app into apps/agy-streamer,
verified building and testing cleanly before any refactoring. Legacy
dead code (server.py, static/, scratch/, test_worker.py,
redesigned_stitch_ui.html, agent_worker.py and its Python env)
intentionally left behind - the Python SDK path is a confirmed dead
end (requires a separate paid API key)."
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

## Task 5: Build the PTY prompt parser (`agy-pty-parser.ts`)

**Files:**
- Modify: `apps/agy-streamer/package.json` (add `node-pty`, `strip-ansi` dependencies)
- Create: `apps/agy-streamer/src/lib/agy-pty-parser.ts`
- Create: `apps/agy-streamer/src/lib/agy-pty-parser.test.ts`

This is the genuinely new, fuzzy logic this migration depends on — turning raw interactive-TUI output into structured prompt events. Built and tested against real captured output from live testing (see the design spec's "Current State" section), not invented.

- [ ] **Step 1: Add dependencies**

In `apps/agy-streamer/package.json`, add under `dependencies`:
```json
    "node-pty": "^1.0.0",
    "strip-ansi": "^7.1.0",
```

```bash
pnpm install
```

- [ ] **Step 2: Write the failing tests first, using real captured fixture output**

Create `apps/agy-streamer/src/lib/agy-pty-parser.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { parseMenuPrompt, selectionKeystrokes, isIdlePrompt } from './agy-pty-parser';

// Captured verbatim (already ANSI-stripped by tmux capture-pane -p) from live
// testing against real agy -i sessions - see docs/superpowers/specs/
// 2026-07-13-agy-streamer-migration-design.md for context.

const WORKSPACE_TRUST_FIXTURE = `Accessing workspace:

/tmp/agy-interactive-test

Do you trust the contents of this project?

Antigravity CLI requires permission to read, edit, and execute files here.

> Yes, I trust this folder
  No, exit

  ↑/↓ Navigate · enter Confirm`;

const COMMAND_APPROVAL_FIXTURE = `Command
────────────────────────────────────────────────────────────────────────────

Requesting permission for:
   pwd

Do you want to proceed?
> 1. Yes
  2. Yes, and always allow in this conversation for commands that start with 'pwd'
  3. Yes, and always allow for commands that start with 'pwd' (Persist to settings.json)
  4. No

  ↑/↓ Navigate · tab Amend · ctrl+g edit/expand command
esc to cancel`;

const FILE_ACCESS_FIXTURE = `Create file
────────────────────────────────────────────────────────────────────────────

/private/tmp/agy-interactive-test/test.txt  +1
   1 +  hello
Reason: outside workspace

Allow creation of this file?
> 1. Yes, allow creation
  2. Yes, and always allow non-workspace access
  3. No, deny creation

  ↑/↓ Navigate · tab Amend · f full diff
esc to cancel`;

const IDLE_FIXTURE = `  I have created the file test.txt in the workspace with the content  hello .

────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────
? for shortcuts                                                     Gemini 3.5 Flash (Medium)`;

const NON_PROMPT_FIXTURE = `▸ Thought for 1s, 736 tokens
  Initiating File Creation
  I will read the schema for the obsidian_append_content tool.

● Read(/Users/rainforest/.gemini/antigravity-cli/mcp/docker-mcp/obsidian_append_content.json)`;

describe('parseMenuPrompt', () => {
  it('parses the unnumbered workspace-trust prompt', () => {
    const result = parseMenuPrompt(WORKSPACE_TRUST_FIXTURE);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('Antigravity CLI requires permission to read, edit, and execute files here.');
    expect(result!.options).toHaveLength(2);
    expect(result!.options[0].label).toBe('Yes, I trust this folder');
    expect(result!.options[0].numberedChoice).toBeNull();
    expect(result!.options[1].label).toBe('No, exit');
  });

  it('parses the numbered command-approval prompt', () => {
    const result = parseMenuPrompt(COMMAND_APPROVAL_FIXTURE);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('Do you want to proceed?');
    expect(result!.options).toHaveLength(4);
    expect(result!.options[0]).toMatchObject({ label: 'Yes', numberedChoice: 1 });
    expect(result!.options[3]).toMatchObject({ label: 'No', numberedChoice: 4 });
  });

  it('parses the numbered file-access prompt', () => {
    const result = parseMenuPrompt(FILE_ACCESS_FIXTURE);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('Allow creation of this file?');
    expect(result!.options).toHaveLength(3);
    expect(result!.options[2]).toMatchObject({ label: 'No, deny creation', numberedChoice: 3 });
  });

  it('returns null for non-prompt activity output', () => {
    expect(parseMenuPrompt(NON_PROMPT_FIXTURE)).toBeNull();
  });

  it('returns null for the idle prompt (no menu present)', () => {
    expect(parseMenuPrompt(IDLE_FIXTURE)).toBeNull();
  });
});

describe('selectionKeystrokes', () => {
  it('sends the number for a numbered option', () => {
    const prompt = parseMenuPrompt(FILE_ACCESS_FIXTURE)!;
    expect(selectionKeystrokes(prompt, 0)).toBe('1\r');
    expect(selectionKeystrokes(prompt, 2)).toBe('3\r');
  });

  it('sends arrow-down presses + enter for unnumbered options', () => {
    const prompt = parseMenuPrompt(WORKSPACE_TRUST_FIXTURE)!;
    expect(selectionKeystrokes(prompt, 0)).toBe('\r');
    expect(selectionKeystrokes(prompt, 1)).toBe('\x1b[B\r');
  });
});

describe('isIdlePrompt', () => {
  it('detects the idle state', () => {
    expect(isIdlePrompt(IDLE_FIXTURE)).toBe(true);
  });

  it('does not mistake a menu prompt for idle', () => {
    expect(isIdlePrompt(FILE_ACCESS_FIXTURE)).toBe(false);
  });

  it('does not mistake mid-activity output for idle', () => {
    expect(isIdlePrompt(NON_PROMPT_FIXTURE)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests, confirm they fail**

```bash
pnpm nx test agy-streamer -- agy-pty-parser.test.ts
```

Expected: FAIL — `./agy-pty-parser` doesn't exist yet.

- [ ] **Step 4: Implement the parser**

Create `apps/agy-streamer/src/lib/agy-pty-parser.ts`:
```typescript
export interface MenuOption {
  label: string;
  raw: string;
  numberedChoice: number | null;
}

export interface MenuPrompt {
  message: string;
  options: MenuOption[];
}

const NAV_HINT_RE = /Navigate|Confirm|esc to cancel/;
const OPTION_LINE_RE = /^[>\s]\s*(?:(\d+)\.\s*)?(.+)$/;
const CURSOR_LINE_RE = /^>\s+\S/;

/**
 * Parses a chunk of ANSI-stripped agy -i terminal output for a menu-style
 * approval prompt (workspace trust / command approval / file access, and
 * potentially unfamiliar shapes like a subagent prompt - see design spec).
 * Returns null if no prompt is present in this chunk.
 */
export function parseMenuPrompt(strippedText: string): MenuPrompt | null {
  const lines = strippedText.split('\n');

  const cursorIdx = lines.findIndex((l) => CURSOR_LINE_RE.test(l));
  if (cursorIdx === -1) return null;

  const optionLines: string[] = [lines[cursorIdx]];
  let i = cursorIdx + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') break;
    if (NAV_HINT_RE.test(line)) break;
    if (!/^\s{2,}\S/.test(line)) break;
    optionLines.push(line);
    i++;
  }

  const lookahead = lines.slice(i, i + 4).join('\n');
  if (!NAV_HINT_RE.test(lookahead)) return null;

  const options: MenuOption[] = optionLines.map((line) => {
    const match = line.match(OPTION_LINE_RE);
    const numberedChoice = match && match[1] ? parseInt(match[1], 10) : null;
    const label = match ? match[2].trim() : line.trim();
    return { label, raw: line, numberedChoice };
  });

  let messageIdx = cursorIdx - 1;
  while (messageIdx >= 0 && lines[messageIdx].trim() === '') messageIdx--;
  const message = messageIdx >= 0 ? lines[messageIdx].trim() : '';

  return { message, options };
}

/**
 * Returns the raw bytes to write to the PTY to select the given option index.
 * Numbered options are chosen by typing their number; unnumbered options
 * (e.g. workspace trust) are chosen positionally via arrow-down presses,
 * since the cursor always starts on the first option when a fresh prompt
 * is parsed.
 */
export function selectionKeystrokes(prompt: MenuPrompt, chosenIndex: number): string {
  const chosen = prompt.options[chosenIndex];
  if (chosen.numberedChoice !== null) {
    return `${chosen.numberedChoice}\r`;
  }
  const downPresses = '\x1b[B'.repeat(chosenIndex);
  return `${downPresses}\r`;
}

/**
 * Detects the idle state: the input prompt with no pending menu and the
 * "? for shortcuts" footer, meaning the agent has finished its turn and is
 * waiting for new input.
 */
export function isIdlePrompt(strippedText: string): boolean {
  const lines = strippedText.trim().split('\n');
  const lastLines = lines.slice(-3).join('\n');
  return /\?\s*for shortcuts/.test(lastLines) && !CURSOR_LINE_RE.test(lastLines);
}
```

- [ ] **Step 5: Run the tests again, confirm they pass**

```bash
pnpm nx test agy-streamer -- agy-pty-parser.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/agy-streamer/package.json apps/agy-streamer/src/lib/agy-pty-parser.ts apps/agy-streamer/src/lib/agy-pty-parser.test.ts
git commit -m "feat(agy-streamer): add PTY prompt parser for agy -i interactive mode

Parses ANSI-stripped terminal output from a real pseudo-terminal into
structured menu-prompt events (message + options), tested against
fixture text captured verbatim from live agy -i sessions. Handles
both numbered (command/file prompts) and unnumbered (workspace-trust
prompt) option formats - they are not consistent, confirmed by
testing all three known shapes."
```

---

## Task 6: Rewire `agent-manager.ts`'s `agy` branch onto `node-pty`, with real approval

**Files:**
- Modify: `apps/agy-streamer/src/lib/agent-manager.ts`
- Modify: `apps/agy-streamer/src/lib/agent-manager.test.ts`
- Modify: `apps/agy-streamer/src/routes/api/sessions/$sessionId/approve.ts`
- Modify: `apps/agy-streamer/src/routes/sessions.$sessionId.tsx`

This replaces the `agy` branch's CLI-shell-out-plus-log-tail approach with `node-pty`-driven interactive mode, using Task 5's parser. `handleToolApproval`'s signature widens from `boolean` to `number` (option index), since prompts can have 2-4 options, not just approve/deny.

- [ ] **Step 1: Write the failing test — `pendingResolve` now resolves with an option index, not a boolean**

Modify the existing approval test in `apps/agy-streamer/src/lib/agent-manager.test.ts` (replace the prior `'should handle tool approvals by resolving pending promises'` test):
```typescript
  it('should handle tool approvals by resolving pending promises with an option index', async () => {
    const session = getOrCreateSession('test-session-789');

    let resolvedValue: number | null = null;
    const promise = new Promise<number>((resolve) => {
      session.pendingResolve = resolve;
    });

    promise.then((val) => {
      resolvedValue = val;
    });

    const approved = handleToolApproval('test-session-789', 2);
    expect(approved).toBe(true);

    const result = await promise;
    expect(result).toBe(2);
    expect(resolvedValue).toBe(2);
  });
```

- [ ] **Step 2: Widen `AgentSession.pendingResolve` and `handleToolApproval`'s type**

Current interface and function (in `agent-manager.ts`):
```typescript
interface AgentSession {
  process: any;
  controllers: Set<ReadableStreamDefaultController>;
  pendingResolve: ((approved: boolean) => void) | null;
}
```
```typescript
export function handleToolApproval(sessionId: string, approved: boolean): boolean {
  const session = activeSessions.get(sessionId);
  if (session && session.pendingResolve) {
    session.pendingResolve(approved);
    return true;
  }
  return false;
}
```

Change to:
```typescript
interface AgentSession {
  process: any;
  controllers: Set<ReadableStreamDefaultController>;
  pendingResolve: ((optionIndex: number) => void) | null;
}
```
```typescript
export function handleToolApproval(sessionId: string, optionIndex: number): boolean {
  const session = activeSessions.get(sessionId);
  if (session && session.pendingResolve) {
    session.pendingResolve(optionIndex);
    return true;
  }
  return false;
}
```

- [ ] **Step 3: Run the test suite, confirm the Step 1 test passes and nothing else broke from the type change**

```bash
pnpm nx test agy-streamer
```

- [ ] **Step 4: Widen `startAgentSession`'s signature to accept an options object (needed for `--model` in this step, wired to the UI in Task 8)**

Current signature:
```typescript
export async function startAgentSession(sessionId: string, directory: string, prompt: string, agentType = 'agy') {
```

Change to:
```typescript
export async function startAgentSession(sessionId: string, directory: string, prompt: string, agentType = 'agy', options: { model?: string } = {}) {
```

- [ ] **Step 5: Replace the `agy` branch's spawn + log-tail logic with `node-pty` + the parser**

Current `agy` branch (the `else` block):
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

Add the import at the top of the file:
```typescript
import * as pty from 'node-pty';
import stripAnsi from 'strip-ansi';
import { parseMenuPrompt, selectionKeystrokes, isIdlePrompt } from './agy-pty-parser';
```

Change the branch to:
```typescript
  } else {
    const agyBinary = path.join(os.homedir(), '.local/bin/agy');
    const ptyProcess = pty.spawn(agyBinary, [
      '-i', prompt,
      '--add-dir', directory,
      '--conversation', sessionId,
      ...(options.model ? ['--model', options.model] : []),
    ], {
      name: 'xterm-256color',
      cols: 200,
      rows: 50,
      cwd: directory,
      env: { ...process.env } as { [key: string]: string },
    });
    child = ptyProcess as any;

    let outputBuffer = '';
    let debounceTimer: NodeJS.Timeout | null = null;
    let lastKnownPrompt: ReturnType<typeof parseMenuPrompt> = null;
    let lastOptionWasDenial = false;

    const isLikelyDenial = (label: string) => /^No\b|deny|Deny/.test(label);

    ptyProcess.onData(async (chunk: string) => {
      outputBuffer += chunk;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const stripped = stripAnsi(outputBuffer);
        await appendLogEntry(sessionId, { type: 'RAW_PTY_OUTPUT', content: stripped, ts: new Date().toISOString() });

        const prompt = parseMenuPrompt(stripped);
        if (prompt) {
          lastKnownPrompt = prompt;
          broadcast(sessionId, {
            type: 'permission_request',
            message: prompt.message,
            options: prompt.options.map((o) => o.label),
          });
          const chosenIndex = await waitForApproval(sessionId);
          lastOptionWasDenial = isLikelyDenial(prompt.options[chosenIndex]?.label ?? '');
          ptyProcess.write(selectionKeystrokes(prompt, chosenIndex));
          outputBuffer = '';
          return;
        }

        if (isIdlePrompt(stripped)) {
          if (lastOptionWasDenial) {
            broadcast(sessionId, { type: 'turn_stopped_after_denial' });
          } else {
            broadcast(sessionId, { type: 'turn_complete', code: 0 });
          }
          lastOptionWasDenial = false;
          outputBuffer = '';
        }
      }, 400);
    });

    ptyProcess.onExit(({ exitCode }) => {
      session.pendingResolve = null;
      broadcast(sessionId, { type: 'turn_complete', code: exitCode });
      session.process = null;
      if (session.controllers.size === 0) {
        activeSessions.delete(sessionId);
      }
    });
  }
```

Note the 400ms debounce: PTY output for a single rendered screen arrives across multiple `data` events (terminal redraws are chunked), so parsing needs to wait for output to settle rather than parsing every individual chunk. This value may need tuning once tested against real usage - it's a starting point, not a proven-optimal number.

- [ ] **Step 6: Remove the now-fully-dead `claude`-branch-adjacent log-tailing code that the old `agy` branch used**

The code block right after the `if/else` (the `logDir`/`tailInterval`/`byteOffset` section, originally written to tail `agy`'s own transcript file) is no longer used by either branch (the `agy` branch is now PTY-driven above, and `claude` was already stdout-driven). Remove it entirely. Verify first: `grep -n "tailInterval\|byteOffset" apps/agy-streamer/src/lib/agent-manager.ts` — confirm no other references before deleting.

- [ ] **Step 7: Update the `/approve` route to pass through a number instead of a boolean**

Current `apps/agy-streamer/src/routes/api/sessions/$sessionId/approve.ts`:
```typescript
          const { decision } = await request.json();
          const success = handleToolApproval(sessionId, decision);
```

Change to:
```typescript
          const { optionIndex } = await request.json();
          const success = handleToolApproval(sessionId, optionIndex);
```

- [ ] **Step 8: Update the frontend's approval card to render a dynamic option list and the "stopped after denial" state**

Current state and SSE handling in `apps/agy-streamer/src/routes/sessions.$sessionId.tsx`:
```tsx
  const [pendingPermission, setPendingPermission] = useState<{
    tool: string;
    args: any;
  } | null>(null);
```
```tsx
        if (payload.type === 'permission_request') {
          setPendingPermission({
            tool: payload.tool,
            args: payload.args
          });
          setIsRunning(false);
        } else if (payload.type === 'turn_complete') {
```

Change the state shape and SSE handler:
```tsx
  const [pendingPermission, setPendingPermission] = useState<{
    message: string;
    options: string[];
  } | null>(null);
  const [turnStopped, setTurnStopped] = useState(false);
```
```tsx
        if (payload.type === 'permission_request') {
          setPendingPermission({
            message: payload.message,
            options: payload.options,
          });
          setTurnStopped(false);
          setIsRunning(false);
        } else if (payload.type === 'turn_stopped_after_denial') {
          setIsRunning(false);
          setPendingPermission(null);
          setTurnStopped(true);
        } else if (payload.type === 'turn_complete') {
```

Add `setTurnStopped(false);` alongside the existing `setPendingPermission(null); setIsRunning(false);` reset at the top of the SSE-connect `useEffect` (where `initialHistory`/`pendingPermission` are reset on session change).

Current approval card JSX:
```tsx
          {pendingPermission && (
            <div className="max-w-4xl mx-auto glass-panel p-5 rounded-2xl border-2 border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)] animate-pulse space-y-4">
              <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400 font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                Action Required: Tool Execution Intercepted
              </h3>
              <div className="text-xs text-slate-300 space-y-2">
                <span>The agent is requesting permission to execute:</span>
                <div className="font-mono bg-slate-950 p-4 rounded-xl border border-slate-900 text-slate-100 whitespace-pre-wrap text-[11px] leading-relaxed">
                  <span className="text-slate-500 font-bold uppercase block mb-1">
                    {pendingPermission.tool} — execution args
                  </span>
                  {JSON.stringify(pendingPermission.args, null, 2)}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button 
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-10 px-5 cursor-pointer shadow-lg shadow-indigo-600/10"
                  onClick={() => approveMutation.mutate(true)}
                >
                  Approve & Execute
                </Button>
                <Button 
                  variant="destructive"
                  className="font-bold text-xs h-10 px-5 cursor-pointer"
                  onClick={() => approveMutation.mutate(false)}
                >
                  Deny & Cancel
                </Button>
              </div>
            </div>
          )}
```

Change to (token classes per Task 4's retrofit — using `bg-card`/`border-primary`/`text-primary` etc. instead of the literal indigo classes shown here, matching whatever this file's Task 4 pass already settled on):
```tsx
          {pendingPermission && (
            <div className="max-w-4xl mx-auto bg-card p-5 rounded-2xl border-2 border-primary/50 space-y-4">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                {pendingPermission.message}
              </h3>
              <div className="flex flex-col gap-2 pt-2">
                {pendingPermission.options.map((label, idx) => (
                  <Button
                    key={idx}
                    variant={/^No\b|deny|Deny/.test(label) ? 'destructive' : 'default'}
                    className="text-xs h-10 px-5 cursor-pointer justify-start"
                    onClick={() => approveMutation.mutate(idx)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {turnStopped && (
            <div className="max-w-4xl mx-auto text-xs text-muted-foreground italic px-2">
              Agent stopped — an action was declined.
            </div>
          )}
```

Update `approveMutation`'s body to send `optionIndex` matching Step 6's route change:
```tsx
  const approveMutation = useMutation({
    mutationFn: async (optionIndex: number) => {
      const res = await fetch(`/api/sessions/${sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex })
      });
      return res.json();
    },
    onSuccess: () => {
      setPendingPermission(null);
      setIsRunning(true);
    }
  });
```

(`ShieldCheck` import from `lucide-react` — this is the same icon swap already covered by Task 4, Step 5; just confirm it's imported at the top of this file if Task 4 already touched it, or add `import { ShieldCheck } from 'lucide-react';` here if not.)

- [ ] **Step 9: Run the full test suite**

```bash
pnpm nx test agy-streamer
```

- [ ] **Step 10: Manual end-to-end verification — the real proof**

```bash
pnpm nx dev agy-streamer
```

Start a real agy session through the UI with a prompt that requires a write tool in a fresh directory (to also exercise the workspace-trust prompt). Confirm: the workspace-trust prompt renders with its 2 unnumbered options, approving it lets the session continue, a subsequent file-write prompt renders with its 3 numbered options, and denying a later prompt shows the "Agent stopped" message instead of a normal completion state.

- [ ] **Step 11: Commit**

```bash
git add apps/agy-streamer/src/lib/agent-manager.ts apps/agy-streamer/src/lib/agent-manager.test.ts apps/agy-streamer/src/routes/api/sessions/\$sessionId/approve.ts apps/agy-streamer/src/routes/sessions.\$sessionId.tsx
git commit -m "fix(agy-streamer): make tool-call approval actually block execution

The agy branch previously shelled out to the real agy CLI in
non-interactive mode with --dangerously-skip-permissions, which
(confirmed by direct testing) never pauses for approval under any
flag combination. Now spawns agy -i through a real pseudo-terminal
(node-pty) and parses its rendered output with the Task 5 parser,
authenticating via the existing Google AI Pro OAuth session (no
separate API key, confirmed by testing). The approval card now
renders the real 2-4 option menus instead of a hardcoded binary
approve/deny, and a denial correctly shows 'Agent stopped' instead of
implying the agent kept working, matching observed real behavior."
```

---

## Task 6b: Rewire `agent-manager.ts`'s `claude` branch onto Remote Control

**Added mid-execution, after live functional testing surfaced two real bugs in the existing `claude` branch and a deeper architectural gap.** During functional verification of both agent types with real sessions, two bugs were found and fixed directly (not part of this task, already committed): the frontend never sent the selected `agentType` to the backend (defaulted every session to `agy` regardless of UI selection), and new session IDs were generated as short non-UUID strings that `claude --session-id` rejects outright. Fixing those surfaced a third, deeper issue that IS this task's subject: even with a valid session, real `claude` subprocess invocations from this app's spawn context failed with `401 authentication_failed` (`apiKeySource: none` in the CLI's own init event) — and separately, per Anthropic's own docs (`https://code.claude.com/docs/en/remote-control`, fetched and read in full during this investigation), Remote Control — the feature that makes a session pick-up-able from the Claude mobile app — is not a background property of any session. It only activates via `claude remote-control` (persistent server mode), `claude --remote-control`/`--rc` (long-running interactive), or `/remote-control` typed inside a session. The current `claude` branch spawns `claude -p <prompt> --output-format stream-json --verbose --dangerously-skip-permissions` — a one-shot, non-interactive invocation that exits after responding. None of the three Remote Control triggers are present, and one-shot `-p` mode is fundamentally incompatible with them (Remote Control requires the local process to *keep running* — closing it ends the session). This is the same category of problem Task 6 fixes for `agy`: a throwaway one-shot spawn can't do what wiring the app to Google AI Pro's live agent required, which was a live, persistent process.

**Do not guess at the integration shape.** This needs the same investigate-first discipline Task 5 used for the PTY parser (built and tested against real captured output, not invented) — this task starts with a spike, not an implementation.

**Files (expected, confirm during the spike):**
- Modify: `apps/agy-streamer/src/lib/agent-manager.ts`
- Possibly modify: `apps/agy-streamer/src/routes/api/sessions/$sessionId/chat.ts`, `apps/agy-streamer/src/routes/sessions.$sessionId.tsx`

- [ ] **Step 1: Confirm authentication actually works outside this session's sandboxed test environment**

The `401 authentication_failed` / `apiKeySource: none` failure observed during testing happened when `claude` was spawned from a dev server itself launched inside a nested, sandboxed Claude Code Bash-tool session — that environment may not carry the same credential access (keychain-backed OAuth, `~/.claude/.credentials.json`, or equivalent) as a normal terminal. Before writing any integration code, verify from a normal terminal (outside any Claude Code sandbox) that:
  1. `claude` is logged in via `/login` (claude.ai OAuth, not an API key — confirmed required by the docs; unset `ANTHROPIC_API_KEY` if present).
  2. `claude remote-control` run manually in a scratch directory successfully registers a session and shows up at `claude.ai/code` and in the Claude mobile app's session list.
  3. This same authenticated state will actually be available in whatever environment Task 10 ends up deploying the persistent `agy-streamer` service into (a `launchd` job's environment is not automatically identical to an interactive login shell's — this is a real risk worth checking early, not after the whole integration is built).

If step 1.2 doesn't work from a plain terminal, this is a genuine blocker upstream of this app entirely — stop and report back rather than guessing at a code-level fix for what may be an account/auth-setup problem.

- [ ] **Step 2: Decide the process-lifecycle model**

`agent-manager.ts` currently spawns one `claude` child process per chat message (transactional, dies after responding). Remote Control needs a persistent process. The docs describe **server mode** (`claude remote-control --spawn worktree --capacity N`) as built for exactly this: one long-running process serving multiple concurrent sessions, each getting its own git worktree on demand. Investigate whether `agy-streamer` should:
  - (a) run one persistent `claude remote-control --spawn worktree` process per `agy-streamer` server instance, mapping agy-streamer session IDs to remote-control session IDs, or
  - (b) spawn one persistent `claude --remote-control --name <sessionTitle>` process per agy-streamer session (simpler mapping, but doesn't share the `--capacity`/worktree-pooling machinery).
  Write up the tradeoff briefly before picking one — this is a real architectural decision, not a detail to bury in a commit message.

- [ ] **Step 3: Prototype the stdout/event bridge**

Whichever mode is chosen, `agent-manager.ts` needs to parse that process's output and re-broadcast it over agy-streamer's existing SSE mechanism (`broadcast(sessionId, data)`), the same pattern the current `-p --output-format stream-json` code already uses — confirm empirically (same technique as Task 5: capture real output, don't assume the schema) that server-mode / `--remote-control` output is still `stream-json`-shaped and compatible with the existing per-line JSON parsing loop, or if it differs, parse the real captured shape.

- [ ] **Step 4: Implement, following whichever design Steps 2-3 converged on, with tests**

Once the shape is confirmed for real, implement following this repo's normal TDD conventions (see Task 6 for the sibling `agy` rewiring as a structural reference — test-first, verify against real captured behavior, not invented mocks of Claude Code's CLI output).

- [ ] **Step 5: Verify end-to-end with a real session, from a real device**

Start a session through `agy-streamer`'s UI, confirm it appears in the Claude mobile app's session list with a green "online" status dot, and confirm a message sent from the phone actually reaches the session and its response streams back into `agy-streamer`'s own UI too (Remote Control is meant to be bidirectional — both surfaces should show the same live conversation).

- [ ] **Step 6: Commit**

Use a real commit message summarizing what was actually built, once Steps 1-5 are done — do not write this in advance, since the exact design isn't known yet.

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

## Task 8: Add `codex` to the UI selector, plus model selection for agy

No persona/`--agent` selector — `agy agents` returned an empty list in testing, nothing to select. Model selection only, and only for the `agy` agent type (the one path that actually reads a `--model` flag in this design).

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

- [ ] **Step 2: Add a model input, gated to only show for the `agy` agent type**

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

`startAgentSession`'s `options: { model?: string }` parameter and the `agy` branch's `pty.spawn` args that consume `options.model` were already added in Task 6 (Steps 4 and 5) — this step only wires the route's request body through to the call, no further signature changes needed.

- [ ] **Step 5: Run tests**

```bash
pnpm nx test agy-streamer
```

Fix any test that constructs a `startAgentSession` call using the old 4-argument signature without the new optional 5th parameter (should still pass, since it's optional with a default, but verify).

- [ ] **Step 6: Manual verification**

```bash
pnpm nx dev agy-streamer
```

Confirm the model input appears only for the `agy` agent type, and a session started with a model value set actually gets the `--model` flag passed through to the PTY spawn (check the TUI banner, which displays the active model — e.g. change it from the default and confirm the banner reflects the override — or add a temporary `console.log` of the `pty.spawn` args in `agent-manager.ts` and remove it after confirming).

- [ ] **Step 7: Commit**

```bash
git add apps/agy-streamer/src/routes/sessions.\$sessionId.tsx apps/agy-streamer/src/routes/api/sessions/\$sessionId/chat.ts apps/agy-streamer/src/lib/agent-manager.ts
git commit -m "feat(agy-streamer): add codex to agent selector, add model selection for agy

Model input only shows for the agy agent type, passed through as
--model to the PTY-spawned agy -i process. No persona/--agent
selector - agy agents returned an empty list in testing, nothing
configured to select."
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

**Why this is a separate repo from the code**: the app's entire purpose depends on spawning `agy`/`claude`/`codex` as local PTY subprocesses on this specific Mac (the `node-pty` native module also needs to be built for this machine — see Step 1). It cannot run on a cloud platform (unlike `personal-website`'s Vercel deploy) — it has to run *here*, persistently, bound to the Tailscale IP. `rainforest-homelab` is the infra-as-code repo for exactly this kind of thing (it already manages other local/homelab services via Terraform and `configs/`), so the *deployment* artifact lives there even though the *code* lives in `rainforest-monorepo`.

**Files:**
- Create: `rainforest-homelab/configs/agy-streamer/tools.rainforest.agy-streamer.plist`
- Create: `rainforest-homelab/configs/agy-streamer/README.md`

- [ ] **Step 1: Confirm dependencies are installed (should already be done from Task 1, this just verifies before deploying)**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
pnpm install
pnpm nx build agy-streamer
```

Expected: builds clean, confirming `node-pty`'s native module compiled successfully for this machine.

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
Tailscale IP, since the app needs local PTY-spawn access to `agy`, `claude`,
and `codex` that only exists here (it cannot run on a cloud platform).

## Install

1. One-time: `cd ~/Repositories/rainforest-monorepo && pnpm install` (builds `node-pty`'s native module for this machine)
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
