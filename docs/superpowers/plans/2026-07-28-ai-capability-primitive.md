# On-Device AI Capability Primitive (E0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the module that owns Chrome Prompt API capability detection, session lifecycle, constrained tool selection, and graceful degradation — so the ⌘K palette (E) and the blog demos (D) cannot diverge on unsupported-browser behaviour.

**Architecture:** A framework-agnostic TypeScript core (`language-model.ts`) with no Vue import, a thin Vue composable over it, and a slot-per-state wrapper component. Capability detection is a three-rung ladder where the third rung — does `responseConstraint` actually work — can only be tested by prompting, so it runs on first real use and may move state from `ready` to `unsupported` mid-flight. WebMCP registration ships as an inert, feature-detected mechanism.

**Tech Stack:** TypeScript 6, Vue 3.5, Vitest 4.1.4 (jsdom), Astro 7. `@types/dom-chromium-ai` is already in `apps/personal-website/tsconfig.json`'s `types` array, so `LanguageModel` is an ambient global — no import, no `declare global`.

**Spec:** [2026-07-28-ai-capability-primitive-design.md](../specs/2026-07-28-ai-capability-primitive-design.md)

---

## File Structure

| File                                                        | Responsibility                                                                                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/personal-website/vitest.config.ts`                    | **Already exists** (PR #224) and already yields an inferred `test` target. Modified only to switch `environment` to `jsdom`. See Task 1's correction note. |
| `apps/personal-website/src/utils/ai/types.ts`               | `AiState`, `ToolDescriptor`. No logic.                                                                                                                     |
| `apps/personal-website/src/utils/ai/language-model.ts`      | The core. Detection, session lifecycle, constrained call, bounds, probe-failure cache.                                                                     |
| `apps/personal-website/src/utils/ai/language-model.test.ts` | Unit tests against a stubbed `LanguageModel` global.                                                                                                       |
| `apps/personal-website/src/utils/ai/webmcp.ts`              | `registerAgentTools()`. Inert when `document.modelContext` is absent.                                                                                      |
| `apps/personal-website/src/utils/ai/webmcp.test.ts`         | Unit tests, including the no-op path (which is every browser today).                                                                                       |
| `apps/personal-website/src/utils/ai/use-language-model.ts`  | Vue composable. Refs + lifecycle cleanup.                                                                                                                  |
| `apps/personal-website/src/utils/ai/AiCapability.vue`       | Slot-per-state wrapper.                                                                                                                                    |
| `apps/personal-website/src/utils/ai/index.ts`               | Barrel export.                                                                                                                                             |

Vue layer (`use-language-model.ts`, `AiCapability.vue`) is verified in the browser during D, per spec §10. Only the framework-agnostic core is unit-tested here.

---

### Task 1: Test infrastructure

> **Corrected 2026-07-28 during execution.** This task originally said _Create_
> `apps/personal-website/vitest.config.ts` on the premise that the app had no test target. That
> premise was wrong — the file has existed since commit `6212b2e` (PR #224), and Nx already
> infers a `test` target from it. The original check missed it because in zsh
> `ls vite.config.* vitest.config.*` aborts the whole command when the _first_ glob has no match,
> reporting "none" while the file was present.
>
> Landing the original content would also have **broken CI**: it dropped `passWithNoTests: true`,
> and `pnpm nx affected -t lint test typecheck` would then fail `personal-website:test` in the
> window before Task 3 adds the first test file.

**Files:**

- Modify: `apps/personal-website/vitest.config.ts`

- [ ] **Step 1: Make the minimal change**

Change only the `environment` line, and add a comment in the voice of the existing one. Keep
`include`, and keep `passWithNoTests: true` **and its full comment** — that comment records a real
decision from PR #224 and is still accurate.

```typescript
    // jsdom rather than node: the on-device AI capability core (src/utils/ai/) caches a
    // failed capability probe in sessionStorage, which node's environment doesn't provide.
    environment: 'jsdom',
```

Do **not** add `root`, `cacheDir`, `watch`, `globals`, `reporters` or `coverage`. Nothing needs
them — the tests import `describe`/`it`/`expect` explicitly from `vitest`, so `globals` is
unnecessary — and churning a working config for cosmetics is not worth it.

- [ ] **Step 2: Verify nothing regressed**

Run: `pnpm nx test personal-website`
Expected: PASS. It reports no test files; `passWithNoTests` keeps that green, which is precisely
why it stays.

Run: `pnpm nx build personal-website`
Expected: `Complete!`

- [ ] **Step 3: Commit**

```bash
git add apps/personal-website/vitest.config.ts
git commit -m "test(personal-website): run app tests in jsdom for the AI capability core"
```

---

### Task 2: Types

**Files:**

- Create: `apps/personal-website/src/utils/ai/types.ts`

- [ ] **Step 1: Write the types**

```typescript
/**
 * The single union every consumer switches on.
 *
 * `unsupported` and `unavailable` are distinct on purpose: they are different sentences to a
 * user ("this browser can't" vs "this machine can't"), and only the first is worth re-probing
 * in a different browser.
 */
export type AiState =
  | { kind: 'unsupported' }
  | { kind: 'unavailable' }
  | { kind: 'downloadable' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'ready' };

/**
 * One tool, described once. `inputSchema` is JSON Schema — the same shape `selectTool()` passes
 * as `responseConstraint` and the same shape WebMCP's `registerTool()` expects. That shared
 * shape is why both live in this module: one descriptor feeds local constrained decoding and
 * remote agent registration, so the two cannot drift.
 *
 * The descriptors themselves belong to E, not here.
 */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm nx build personal-website`
Expected: `Complete!` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/personal-website/src/utils/ai/types.ts
git commit -m "feat(ai): add AiState and ToolDescriptor types"
```

---

### Task 3: `detectCapability()` — rungs 1 and 2

**Files:**

- Create: `apps/personal-website/src/utils/ai/language-model.test.ts`
- Create: `apps/personal-website/src/utils/ai/language-model.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectCapability, __resetForTests } from './language-model';

type Availability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

/** Install a stub `LanguageModel` global. Pass `null` to remove it entirely. */
function stubLanguageModel(availability: Availability | null) {
  if (availability === null) {
    Reflect.deleteProperty(globalThis, 'LanguageModel');
    return;
  }
  Object.defineProperty(globalThis, 'LanguageModel', {
    configurable: true,
    writable: true,
    value: { availability: vi.fn(async () => availability), create: vi.fn() },
  });
}

afterEach(() => {
  stubLanguageModel(null);
  sessionStorage.clear();
  __resetForTests();
});

describe('detectCapability', () => {
  it('reports unsupported when the global is absent', async () => {
    stubLanguageModel(null);
    expect(await detectCapability()).toEqual({ kind: 'unsupported' });
  });

  it('maps availability() onto the state machine', async () => {
    stubLanguageModel('unavailable');
    expect(await detectCapability()).toEqual({ kind: 'unavailable' });

    stubLanguageModel('downloadable');
    expect(await detectCapability()).toEqual({ kind: 'downloadable' });

    stubLanguageModel('downloading');
    expect(await detectCapability()).toEqual({
      kind: 'downloading',
      progress: 0,
    });

    stubLanguageModel('available');
    expect(await detectCapability()).toEqual({ kind: 'ready' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-website`
Expected: FAIL — cannot resolve `./language-model`.

- [ ] **Step 3: Write the minimal implementation**

```typescript
import type { AiState } from './types';

/**
 * Bumped when the probe's meaning changes, so a browser update re-probes rather than inheriting
 * a stale "this browser can't" verdict.
 */
const PROBE_CACHE_KEY = 'rf:ai:constraint-probe:v1';

let probeFailed = false;

/** Test-only: clear module state between cases. */
export function __resetForTests(): void {
  probeFailed = false;
}

function hasProbeFailure(): boolean {
  if (probeFailed) return true;
  try {
    return sessionStorage.getItem(PROBE_CACHE_KEY) === 'failed';
  } catch {
    // Private mode or blocked storage — treat as "not yet probed" rather than failing shut.
    return false;
  }
}

/**
 * Rungs 1 and 2 of the capability ladder. Rung 3 (does `responseConstraint` actually work) needs
 * a session, which needs a download, which needs a user gesture — so it runs in `selectTool()`.
 */
export async function detectCapability(): Promise<AiState> {
  if (typeof LanguageModel === 'undefined') return { kind: 'unsupported' };
  if (hasProbeFailure()) return { kind: 'unsupported' };

  const availability = await LanguageModel.availability();
  switch (availability) {
    case 'unavailable':
      return { kind: 'unavailable' };
    case 'downloadable':
      return { kind: 'downloadable' };
    case 'downloading':
      return { kind: 'downloading', progress: 0 };
    default:
      return { kind: 'ready' };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-website`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/personal-website/src/utils/ai/language-model.ts apps/personal-website/src/utils/ai/language-model.test.ts
git commit -m "feat(ai): detect Prompt API capability (presence + availability)"
```

---

### Task 4: `enableModel()` — gesture-triggered download

**Files:**

- Modify: `apps/personal-website/src/utils/ai/language-model.ts`
- Modify: `apps/personal-website/src/utils/ai/language-model.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `language-model.test.ts`:

```typescript
describe('enableModel', () => {
  it('throws a clear error when the API is absent', async () => {
    stubLanguageModel(null);
    await expect(enableModel()).rejects.toThrow(/not available/i);
  });

  it('creates a session and reports download progress', async () => {
    const events: number[] = [];
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'downloadable'),
        create: vi.fn(async (opts: { monitor?: (m: EventTarget) => void }) => {
          const monitor = new EventTarget();
          opts.monitor?.(monitor);
          const event = new Event('downloadprogress') as Event & {
            loaded: number;
            total: number;
          };
          event.loaded = 5;
          event.total = 10;
          monitor.dispatchEvent(event);
          return { prompt: vi.fn(), destroy: vi.fn() };
        }),
      },
    });

    await enableModel((p) => events.push(p));
    expect(events).toEqual([0.5]);
  });

  it('surfaces NotAllowedError rather than hanging when called outside a user gesture', async () => {
    // The platform throws this when create() runs outside a click handler. It must reject, not
    // hang — a hung enable leaves the UI stuck on "downloading" forever.
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'downloadable'),
        create: vi.fn(async () => {
          throw new DOMException('requires a user gesture', 'NotAllowedError');
        }),
      },
    });

    await expect(enableModel()).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
  });
});
```

Add `enableModel` to the import at the top of the file.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-website`
Expected: FAIL — `enableModel` is not exported.

- [ ] **Step 3: Write the implementation**

Add to `language-model.ts`:

```typescript
type Session = {
  prompt: (input: string, opts?: unknown) => Promise<string>;
  destroy: () => void;
};

let session: Session | null = null;

/**
 * Starts the model download and opens a session.
 *
 * MUST be called synchronously from a click handler. The first `create()` triggers a
 * multi-hundred-megabyte download and throws `NotAllowedError` outside a user gesture, so this
 * cannot be called on ⌘K-open or on keystroke — consumers wire it to an explicit control.
 */
export async function enableModel(
  onProgress?: (progress: number) => void,
): Promise<void> {
  if (typeof LanguageModel === 'undefined') {
    throw new Error('Prompt API is not available in this browser');
  }

  session = (await LanguageModel.create({
    // Output is pinned to English: non-English replies are unreliable on current on-device models.
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
    monitor(m: EventTarget) {
      m.addEventListener('downloadprogress', (event) => {
        const { loaded, total } = event as Event & {
          loaded: number;
          total: number;
        };
        onProgress?.(total > 0 ? loaded / total : 0);
      });
    },
  } as never)) as unknown as Session;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-website`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/personal-website/src/utils/ai/language-model.ts apps/personal-website/src/utils/ai/language-model.test.ts
git commit -m "feat(ai): gesture-triggered model download with progress"
```

---

### Task 5: `selectTool()` and the ready→unsupported transition

This is the task the spec calls the single most important thing to get right.

**Files:**

- Modify: `apps/personal-website/src/utils/ai/language-model.ts`
- Modify: `apps/personal-website/src/utils/ai/language-model.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `language-model.test.ts`:

```typescript
function stubSession(prompt: (q: string, o?: unknown) => Promise<string>) {
  Object.defineProperty(globalThis, 'LanguageModel', {
    configurable: true,
    writable: true,
    value: {
      availability: vi.fn(async () => 'available'),
      create: vi.fn(async () => ({ prompt, destroy: vi.fn() })),
    },
  });
}

const SCHEMA = { type: 'object', properties: { tool: { type: 'string' } } };

describe('selectTool', () => {
  it('returns parsed schema-valid JSON', async () => {
    stubSession(async () => '{"tool":"get_skills"}');
    await enableModel();
    expect(await selectTool('what can he do', SCHEMA)).toEqual({
      tool: 'get_skills',
    });
  });

  it('passes the schema as responseConstraint', async () => {
    // Explicit generic: an argumentless `vi.fn(async () => ...)` infers Mock<() => Promise<string>>,
    // so `mock.calls` is typed `[][]` and `calls[0][1]` is out of bounds. Runtime is fine, but
    // `astro check` type-checks test files and rejects it.
    const prompt = vi.fn<(q: string, o?: unknown) => Promise<string>>(
      async () => '{"tool":"x"}',
    );
    stubSession(prompt);
    await enableModel();
    await selectTool('q', SCHEMA);
    expect(prompt.mock.calls[0][1]).toMatchObject({
      responseConstraint: SCHEMA,
    });
  });

  it('degrades ready -> unsupported when the first constrained call fails', async () => {
    stubSession(async () => {
      throw new DOMException('nope', 'NotSupportedError');
    });
    await enableModel();
    expect(await detectCapability()).toEqual({ kind: 'ready' });

    await expect(selectTool('q', SCHEMA)).rejects.toThrow();

    // The transition the spec warns about: it reported ready, then the probe failed.
    expect(await detectCapability()).toEqual({ kind: 'unsupported' });
    expect(sessionStorage.getItem('rf:ai:constraint-probe:v1')).toBe('failed');
  });

  it('does not blame the browser for a later failure after one success', async () => {
    let calls = 0;
    stubSession(async () => {
      calls += 1;
      if (calls === 1) return '{"tool":"ok"}';
      throw new Error('transient');
    });
    await enableModel();
    await selectTool('q', SCHEMA);
    await expect(selectTool('q', SCHEMA)).rejects.toThrow('transient');

    // One success proves the browser can do this — a later error is not a capability verdict.
    expect(sessionStorage.getItem('rf:ai:constraint-probe:v1')).toBeNull();
  });

  it('throws when called before enableModel', async () => {
    stubLanguageModel('available');
    await expect(selectTool('q', SCHEMA)).rejects.toThrow(/enableModel/);
  });
});
```

Add `selectTool` to the import at the top of the file.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-website`
Expected: FAIL — `selectTool` is not exported.

- [ ] **Step 3: Write the implementation**

Add to `language-model.ts`:

```typescript
/** Wall clock, not step count. On-device inference blocks the main thread, so a hung run has to
 *  be cut off by an abort signal the platform honours rather than a timer we can't fire. */
const RUN_TIMEOUT_MS = 20_000;

let hasSucceededOnce = false;

function markProbeFailed(): void {
  probeFailed = true;
  try {
    sessionStorage.setItem(PROBE_CACHE_KEY, 'failed');
  } catch {
    // Storage blocked; the in-memory flag still holds for this page.
  }
}

/**
 * One constrained call per turn. `responseConstraint` guarantees schema-valid JSON by
 * construction, so there is no free-form parse step to fail.
 *
 * If the FIRST call fails, we treat it as rung 3 of the capability ladder failing and degrade to
 * `unsupported`. After one success we never blame the browser again — a later error is transient,
 * not a capability verdict. Aborts are excluded either way: a timeout says nothing about support.
 */
export async function selectTool<T>(
  query: string,
  schema: Record<string, unknown>,
  opts: { signal?: AbortSignal } = {},
): Promise<T> {
  if (!session)
    throw new Error('enableModel() must be called before selectTool()');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
  opts.signal?.addEventListener('abort', () => controller.abort(), {
    once: true,
  });

  try {
    const raw = await session.prompt(query, {
      responseConstraint: schema,
      signal: controller.signal,
    });
    hasSucceededOnce = true;
    return JSON.parse(raw) as T;
  } catch (error) {
    const aborted =
      error instanceof DOMException && error.name === 'AbortError';
    if (!hasSucceededOnce && !aborted) markProbeFailed();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
```

Update `__resetForTests` to also clear the new flag:

```typescript
export function __resetForTests(): void {
  probeFailed = false;
  hasSucceededOnce = false;
  session = null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-website`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/personal-website/src/utils/ai/language-model.ts apps/personal-website/src/utils/ai/language-model.test.ts
git commit -m "feat(ai): constrained tool selection with first-use capability probe"
```

---

### Task 6: `destroy()`

**Files:**

- Modify: `apps/personal-website/src/utils/ai/language-model.ts`
- Modify: `apps/personal-website/src/utils/ai/language-model.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `language-model.test.ts`:

```typescript
describe('destroy', () => {
  it('releases the session and is safe to call twice', async () => {
    const destroySpy = vi.fn();
    Object.defineProperty(globalThis, 'LanguageModel', {
      configurable: true,
      writable: true,
      value: {
        availability: vi.fn(async () => 'available'),
        create: vi.fn(async () => ({ prompt: vi.fn(), destroy: destroySpy })),
      },
    });

    await enableModel();
    destroy();
    destroy();

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
```

Add `destroy` to the import at the top of the file.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-website`
Expected: FAIL — `destroy` is not exported.

- [ ] **Step 3: Write the implementation**

Add to `language-model.ts`:

```typescript
/** Sessions hold the model in memory; the platform guidance requires explicit release. */
export function destroy(): void {
  session?.destroy();
  session = null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-website`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/personal-website/src/utils/ai/language-model.ts apps/personal-website/src/utils/ai/language-model.test.ts
git commit -m "feat(ai): release the model session explicitly"
```

---

### Task 7: WebMCP registration

> **Revised 2026-07-28 during execution.** The signature below took a required `AbortSignal`;
> it now owns its own `AbortController` and returns `{ registered, dispose }`. See the spec's §8
> revision note for why — in short, a required signal makes callers _look_ responsible without
> making them _be_ responsible. The code blocks in this task are superseded by the shipped
> implementation in `apps/personal-website/src/utils/ai/webmcp.ts`.

**Files:**

- Create: `apps/personal-website/src/utils/ai/webmcp.ts`
- Create: `apps/personal-website/src/utils/ai/webmcp.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerAgentTools } from './webmcp';
import type { ToolDescriptor } from './types';

const TOOLS: ToolDescriptor[] = [
  {
    name: 'get_skills',
    description: 'List technical skills',
    inputSchema: { type: 'object', properties: {} },
    execute: () => ['typescript'],
  },
];

afterEach(() => {
  Reflect.deleteProperty(document, 'modelContext');
});

describe('registerAgentTools', () => {
  it('no-ops and reports false when WebMCP is absent', () => {
    // This is every browser today — the default path, not an edge case.
    expect(registerAgentTools(TOOLS, new AbortController().signal)).toBe(false);
  });

  it('registers each tool with the abort signal when WebMCP exists', () => {
    const registerTool = vi.fn();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool },
    });
    const controller = new AbortController();

    expect(registerAgentTools(TOOLS, controller.signal)).toBe(true);
    expect(registerTool).toHaveBeenCalledTimes(1);

    const [descriptor, options] = registerTool.mock.calls[0];
    expect(descriptor.name).toBe('get_skills');
    expect(descriptor.inputSchema).toEqual(TOOLS[0].inputSchema);
    expect(descriptor.annotations).toEqual({ readOnlyHint: true });
    expect(options).toEqual({ signal: controller.signal });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm nx test personal-website`
Expected: FAIL — cannot resolve `./webmcp`.

- [ ] **Step 3: Write the implementation**

```typescript
import type { ToolDescriptor } from './types';

type ModelContext = {
  registerTool: (
    descriptor: ToolDescriptor & { annotations: { readOnlyHint: boolean } },
    options: { signal: AbortSignal },
  ) => void;
};

/**
 * Expose tools to external agents via WebMCP.
 *
 * `document.modelContext` exists in no shipping browser as of 2026-07-28 (verified: Chrome 150,
 * Edge 150, Chromium 148), so this returns false and does nothing today. It is built now because
 * WebMCP's `inputSchema` is JSON Schema — the same shape `selectTool()` passes as
 * `responseConstraint` — so one descriptor serves both and they cannot drift.
 *
 * Deliberately NOT part of `AiState`: WebMCP availability is orthogonal to whether the local
 * model can run, and conflating them would let one break the other.
 *
 * Unregistration is via `signal` only — WebMCP has no `unregisterTool()`. This function owns that
 * contract so consumers cannot leak registrations across route changes.
 */
export function registerAgentTools(
  tools: ToolDescriptor[],
  signal: AbortSignal,
): boolean {
  const context = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  if (!context?.registerTool) return false;

  for (const tool of tools) {
    // Every tool here reads profile data and mutates nothing.
    context.registerTool(
      { ...tool, annotations: { readOnlyHint: true } },
      { signal },
    );
  }
  return true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm nx test personal-website`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/personal-website/src/utils/ai/webmcp.ts apps/personal-website/src/utils/ai/webmcp.test.ts
git commit -m "feat(ai): WebMCP tool registration, inert until browsers ship it"
```

---

### Task 8: Vue composable

**Files:**

- Create: `apps/personal-website/src/utils/ai/use-language-model.ts`

- [ ] **Step 1: Write the composable**

```typescript
import { onUnmounted, readonly, ref } from 'vue';

import {
  destroy,
  detectCapability,
  enableModel as enableModelCore,
  selectTool as selectToolCore,
} from './language-model';
import type { AiState } from './types';

/**
 * Vue adapter over the framework-agnostic core. Holds no logic of its own beyond reactivity and
 * cleanup — everything fragile lives in language-model.ts so a React consumer could reuse it.
 */
export function useLanguageModel() {
  const state = ref<AiState>({ kind: 'unsupported' });
  const error = ref<Error | null>(null);

  async function refresh(): Promise<void> {
    state.value = await detectCapability();
  }

  /** Must be invoked directly from a click handler — see enableModel() in the core. */
  async function enable(): Promise<void> {
    error.value = null;
    try {
      state.value = { kind: 'downloading', progress: 0 };
      await enableModelCore((progress) => {
        state.value = { kind: 'downloading', progress };
      });
      state.value = { kind: 'ready' };
    } catch (cause) {
      error.value = cause as Error;
      await refresh();
    }
  }

  async function selectTool<T>(
    query: string,
    schema: Record<string, unknown>,
  ): Promise<T | null> {
    try {
      return await selectToolCore<T>(query, schema);
    } catch (cause) {
      error.value = cause as Error;
      // The core may have degraded ready -> unsupported on a first-call failure; re-read rather
      // than assuming the previous state still holds.
      await refresh();
      return null;
    }
  }

  onUnmounted(destroy);

  return {
    state: readonly(state),
    error: readonly(error),
    refresh,
    enable,
    selectTool,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm nx build personal-website`
Expected: `Complete!` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/personal-website/src/utils/ai/use-language-model.ts
git commit -m "feat(ai): Vue composable over the capability core"
```

---

### Task 9: `AiCapability.vue`

**Files:**

- Create: `apps/personal-website/src/utils/ai/AiCapability.vue`

- [ ] **Step 1: Write the component**

```vue
<script setup lang="ts">
import { onMounted } from 'vue';

import { useLanguageModel } from './use-language-model';

// Slot per state. This component supplies no copy and no assets: D provides the recorded demo,
// and because ⌘K degrades to deterministic search, the `unsupported` slot's default is the plain
// search UI rather than an apology.
const { state, error, refresh, enable } = useLanguageModel();

onMounted(refresh);
</script>

<template>
  <slot v-if="state.kind === 'ready'" name="ready" />
  <slot
    v-else-if="state.kind === 'downloading'"
    name="downloading"
    :progress="state.progress"
  />
  <slot
    v-else-if="state.kind === 'downloadable'"
    name="downloadable"
    :enable="enable"
  />
  <slot v-else-if="state.kind === 'unavailable'" name="unavailable" />
  <slot v-else name="unsupported" :error="error" />
</template>
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm nx build personal-website`
Expected: `Complete!` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/personal-website/src/utils/ai/AiCapability.vue
git commit -m "feat(ai): slot-per-state capability wrapper"
```

---

### Task 10: Barrel export and final verification

**Files:**

- Create: `apps/personal-website/src/utils/ai/index.ts`

- [ ] **Step 1: Write the barrel**

```typescript
export { default as AiCapability } from './AiCapability.vue';
export {
  destroy,
  detectCapability,
  enableModel,
  selectTool,
} from './language-model';
export type { AiState, ToolDescriptor } from './types';
export { useLanguageModel } from './use-language-model';
export { registerAgentTools } from './webmcp';
```

- [ ] **Step 2: Run the full check**

Run: `pnpm nx test personal-website && pnpm nx build personal-website && pnpm nx lint personal-website`
Expected: 13 tests pass, build `Complete!`, lint reports no new errors.

- [ ] **Step 3: Verify the dev server still starts clean**

Run: `pnpm nx dev personal-website`
Expected: server starts with no `$RefreshSig$` error. Stop it after confirming.

- [ ] **Step 4: Commit**

```bash
git add apps/personal-website/src/utils/ai/index.ts
git commit -m "feat(ai): barrel export for the capability primitive"
```

---

## Correction to spec §6

The spec lists _"model output is untrusted — `textContent`, never `innerHTML`"_ among the rules
**E0 enforces**. E0 cannot enforce it: E0 never renders, and after this plan every rendering
decision belongs to the slot content that E and D supply. Listing it as enforced would give false
assurance.

It is a real rule and it still applies — it just belongs to the **consumer**, so it moves to E's
spec as a requirement on how tool results are displayed. No task here implements it, deliberately.

## Lint is a gate, not an afterthought

This repo enforces `simple-import-sort` via ESLint (see the root `CLAUDE.md`). Tasks 3–6 each
append a new named import to the same line in `language-model.test.ts`, so the import list grows
unsorted and trips the rule — but only if something checks. No task in the original plan ran lint,
so it went unnoticed until the end of the group.

**Run `pnpm nx lint personal-website --fix` after each task that adds an import**, and commit the
result with the task rather than as a separate cleanup.

## A known limit of these tests

Every stub installs the global via `Object.defineProperty(globalThis, 'LanguageModel', { value: … })`.
`PropertyDescriptor.value` is typed `any`, so **none of these stubs is checked against the real
ambient `LanguageModel` type** from `@types/dom-chromium-ai`. The stubs implement only
`availability` and `create`; the fake session only `prompt` and `destroy`.

This is fine — it is the ordinary way to stub a global, and typing it faithfully would mean
maintaining a fake that tracks an abstract class we do not control. Record it so the blast radius
is known: if that types package is bumped and `availability()` gains a required argument, or
`create()`'s return shape changes, **this suite will keep passing while the real code breaks**.
Re-verify against a real browser (workstream D) after any such bump.

## Verification order matters

`astro check` (run as part of `pnpm nx build personal-website`) type-checks **test files too**, so
the suite must satisfy the app's strict TypeScript config — not merely run green under Vitest,
whose transform does not type-check.

Each task above verifies with `nx test` alone, which is correct for the TDD loop but means a
type-only defect can survive several tasks before the build catches it. That happened during
execution: the mock typing above passed every `nx test` run and only surfaced at the end.

**When executing, run `pnpm nx build personal-website` after each task that touches a `.test.ts`
file**, not just at the end.

## Definition of done

- `pnpm nx test personal-website` passes with 13 tests, including the `ready → unsupported` transition and the WebMCP no-op path.
- `pnpm nx build personal-website` and `pnpm nx lint personal-website` are clean.
- No consumer wiring exists yet — E and D consume this next. E0 ships plumbing, not content.

## Next

**E** — the ⌘K palette: deterministic fuzzy search over `@rainforest-dev/personal-data`, with the tool catalog shared with `src/pages/mcp.ts` so the remote MCP surface and the local palette cannot drift, and the AI path layered on via `selectTool()`.
