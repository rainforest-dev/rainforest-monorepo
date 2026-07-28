# On-Device AI Capability Primitive (E0) — Design Spec

- **Date:** 2026-07-28
- **Branch:** `claude/ai-capability-primitive`
- **Status:** Design approved in brainstorming; pending written-spec review → implementation plan.
- **Chain:** step **E0** of [2026-07-27-browser-ai-chain-design.md](./2026-07-27-browser-ai-chain-design.md). A is merged (#255).

## 1. Goal

One module owning every fragile part of Chrome's Prompt API, consumed by both the ⌘K command
palette (**E**) and the blog demos (**D**). Built once so the two cannot diverge on
unsupported-browser behaviour — the failure this step exists to prevent is two different "your
browser can't do this" experiences on the same site.

E0 ships **plumbing, not content**. It knows which state the browser is in and what may legally be
called in that state. It does not know what a tool is, what the palette looks like, or what the
fallback says.

### Decisions locked in brainstorming

1. **Framework-agnostic core + thin Vue adapter.** Both current consumers are Vue, but the
   portfolio library is React and the prior implementation this design derives from was React, so
   the core carries no framework import.
2. **⌘K degrades to deterministic search, not to an apology.** The palette is a fuzzy search over
   `@rainforest-dev/personal-data` that works everywhere; on-device AI is an *upgrade* that adds
   natural-language querying. This makes the unsupported path a working feature rather than a
   recorded video, and it is why E0's fallback slot is cheap.
3. **Feature detection only — no UA sniffing.** See §4; this reverses an earlier assumption and the
   reversal is load-bearing.

## 2. Module layout

`apps/personal-website/src/utils/ai/`

| File | Responsibility |
|---|---|
| `language-model.ts` | Framework-agnostic core. No Vue import. Owns detection, session lifecycle, the constrained call, and bounds. |
| `use-language-model.ts` | Vue composable exposing the core as refs, plus lifecycle cleanup. |
| `AiCapability.vue` | Slot-per-state wrapper. Maps `AiState` to whichever slot the consumer supplied. |

`@types/dom-chromium-ai` is already in `apps/personal-website/tsconfig.json`'s `types` array, so
`LanguageModel` is an ambient global. No import and no `declare global` shim.

## 3. State machine

One discriminated union — the only thing consumers switch on.

```ts
type AiState =
  | { kind: 'unsupported' }                    // no global, or the constraint probe failed
  | { kind: 'unavailable' }                    // availability() === 'unavailable' (hardware)
  | { kind: 'downloadable' }                   // present and runnable, needs a gesture
  | { kind: 'downloading'; progress: number }  // monitor → downloadprogress
  | { kind: 'ready' };
```

`unsupported` and `unavailable` are kept distinct because they are different sentences to a user
("this browser can't", versus "this machine can't") and because only the first is worth re-probing
in a different browser.

## 4. Detection is a first-use guard, not a pre-flight check

The capability ladder has three rungs and **the third cannot be climbed early**:

1. `typeof LanguageModel !== 'undefined'` — synchronous, free.
2. `await LanguageModel.availability()` → `unavailable | downloadable | downloading | available` —
   async, free, no session required.
3. Does `responseConstraint` actually work? **Only answerable by prompting**, which requires a
   session, which requires the model to be downloaded, which requires a user gesture.

So rung 3 runs on **first real use**, after `ready`. If the constrained call fails, E0 transitions
to `unsupported` *after* having reported `ready`, and caches that per session
(`sessionStorage`, keyed by a version string so a browser update re-probes).

Consumers must therefore tolerate a `ready → unsupported` transition mid-flight. This is the
single most important thing to get right: a palette that renders "ready" and then throws on the
first query is a worse experience than one that never claimed to be ready.

**Why no UA gate.** An earlier design gated on `!/Edg\//.test(ua)` because Edge's `prompt()`
rejects the `tool` role. That gate was correct for a *tool-role round-trip* architecture, which
this design does not use — tool selection is a single `responseConstraint` call whose result is
executed in JS, and Edge's documentation confirms `responseConstraint` (JSON schema or regex) is
supported. A UA denylist would exclude a browser that can probably run this, and would rot as
engines change. Feature detection is self-correcting; a regex is not.

## 5. Public surface

```ts
detectCapability(): Promise<AiState>
enableModel(onProgress?: (p: number) => void): Promise<void>
selectTool<T>(query: string, schema: object, opts?: { signal?: AbortSignal }): Promise<T>
destroy(): void
```

- **`enableModel()` must be called synchronously from a click handler.** The first `create()`
  triggers a multi-hundred-MB download and throws `NotAllowedError` outside a user gesture. It
  cannot be called on ⌘K-open or on keystroke. Consumers wire it to an explicit control.
- **`selectTool()` is one constrained call per turn.** It returns schema-valid JSON by
  construction; there is no parse step to fail.

## 6. Rules E0 enforces

Encoded in the module so consumers cannot get them wrong individually:

| Rule | Why |
|---|---|
| One constrained call per turn; no multi-step loops | Multi-step is unreliable, and each call lengthens the main-thread freeze |
| Wall-clock timeout on every run, via `AbortSignal` | On-device inference is single-threaded; a `setTimeout` watchdog cannot fire while the thread is blocked |
| `session.destroy()` on unmount / navigation | Sessions hold the model in memory; the platform guide requires explicit release |
| Model output is **untrusted** — `textContent`, never `innerHTML` | Marked MANDATORY by the platform guidance; output can contain injected markup |
| Output pinned to English via `expectedOutputs` | Non-English output is unreliable on the current on-device models |

## 7. Fallback contract

`<AiCapability>` exposes one named slot per `AiState` kind. E0 supplies no copy and no assets — D
produces the recorded demo later, and can only do so once E works.

Because ⌘K degrades to deterministic search (§1, decision 2), the `unsupported` slot's default is
the plain search UI. The recording is for the blog post's *demos*, not a crutch for the palette.

## 8. Out of scope

- The tool catalog and its descriptors — that is **E**, and it must be shared with
  `src/mcp/profile.ts` so the remote MCP surface and the local palette cannot drift.
- Server-model fallback, streaming chat UI, multi-step agent loops — excluded by the chain spec.
- **WebMCP (`document.modelContext`)** — registering the same tools for external agents is a
  genuinely attractive second consumer, but the descriptors belong to E. Revisit once E exists.

## 9. Testing

- Core is framework-agnostic, so it unit-tests under Vitest with a stubbed `LanguageModel` global.
- Cover each ladder rung: absent global; `availability()` returning each value; a successful probe;
  and **a probe that fails after `ready`**, which is the transition most likely to regress.
- `enableModel()` outside a gesture must surface `NotAllowedError` rather than hanging.
- Real-browser behaviour is verified in D, not here.

## 10. Next step

Implementation plan for E0, then **E** (⌘K palette) consuming it.
