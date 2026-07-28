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
   `@rainforest-dev/personal-data` that works everywhere; on-device AI is an _upgrade_ that adds
   natural-language querying. This makes the unsupported path a working feature rather than a
   recorded video, and it is why E0's fallback slot is cheap.
3. **Feature detection only — no UA sniffing.** See §4; this reverses an earlier assumption and the
   reversal is load-bearing.

## 2. Module layout

`apps/personal-website/src/utils/ai/`

| File                    | Responsibility                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `language-model.ts`     | Framework-agnostic core. No Vue import. Owns detection, session lifecycle, the constrained call, and bounds. |
| `use-language-model.ts` | Vue composable exposing the core as refs, plus lifecycle cleanup.                                            |
| `AiCapability.vue`      | Slot-per-state wrapper. Maps `AiState` to whichever slot the consumer supplied.                              |

`@types/dom-chromium-ai` is already in `apps/personal-website/tsconfig.json`'s `types` array, so
`LanguageModel` is an ambient global. No import and no `declare global` shim.

## 3. State machine

One discriminated union — the only thing consumers switch on.

```ts
type AiState =
  | { kind: 'unsupported' } // no global, or the constraint probe failed
  | { kind: 'unavailable' } // availability() === 'unavailable' (hardware)
  | { kind: 'downloadable' } // present and runnable, needs a gesture
  | { kind: 'downloading'; progress: number } // monitor → downloadprogress
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
to `unsupported` _after_ having reported `ready`, and caches that per session
(`sessionStorage`, keyed by a version string so a browser update re-probes).

Consumers must therefore tolerate a `ready → unsupported` transition mid-flight. This is the
single most important thing to get right: a palette that renders "ready" and then throws on the
first query is a worse experience than one that never claimed to be ready.

**Why no UA gate.** An earlier design gated on `!/Edg\//.test(ua)` because Edge's `prompt()`
rejects the `tool` role. That gate was correct for a _tool-role round-trip_ architecture, which
this design does not use — tool selection is a single `responseConstraint` call whose result is
executed in JS, and Edge documents `responseConstraint` (JSON schema or regex) as supported.

Measured on 2026-07-28 rather than assumed, on this machine, default profiles, no flags:

| Global                                           | Chrome 150 stable | Edge 150 stable | Chromium 148 (in-app)                  |
| ------------------------------------------------ | ----------------- | --------------- | -------------------------------------- |
| `LanguageModel`                                  | ✅                | ❌              | ✅ (`availability()` → `downloadable`) |
| `document.modelContext`                          | ❌                | ❌              | ❌                                     |
| `Summarizer` / `Translator` / `LanguageDetector` | ✅                | ✅              | ✅                                     |
| `Writer` / `Rewriter` / `Proofreader`            | ❌                | ❌              | —                                      |

**Stable Edge does not expose `LanguageModel` at all** — the Prompt API remains Canary/Dev behind a
flag. So a UA gate would have excluded a browser that already excludes itself, while risking a
wrong answer the moment Edge ships. Feature detection is self-correcting; a regex is not.

(`availability()` does not resolve under `--headless`, so the trustworthy reading is the
non-headless `downloadable`. Headless numbers are not evidence of real-world availability.)

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

| Rule                                                             | Why                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| One constrained call per turn; no multi-step loops               | Multi-step is unreliable, and each call lengthens the main-thread freeze                                |
| Wall-clock timeout on every run, via `AbortSignal`               | On-device inference is single-threaded; a `setTimeout` watchdog cannot fire while the thread is blocked |
| `session.destroy()` on unmount / navigation                      | Sessions hold the model in memory; the platform guide requires explicit release                         |
| Model output is **untrusted** — `textContent`, never `innerHTML` | Marked MANDATORY by the platform guidance; output can contain injected markup                           |
| Output pinned to English via `expectedOutputs`                   | Non-English output is unreliable on the current on-device models                                        |

## 7. Fallback contract

`<AiCapability>` exposes one named slot per `AiState` kind. E0 supplies no copy and no assets — D
produces the recorded demo later, and can only do so once E works.

Because ⌘K degrades to deterministic search (§1, decision 2), the `unsupported` slot's default is
the plain search UI. The recording is for the blog post's _demos_, not a crutch for the palette.

## 8. WebMCP — designed for, not depended on

`document.modelContext.registerTool()` (WebMCP) lets a page expose client-side JS functions as
tools to external agents. That makes it a natural second consumer of the same descriptors the
palette uses: one catalog would then serve the local model, remote MCP clients via
`src/pages/mcp.ts`, and browser agents.

**It does not exist in any browser available to test** — `document.modelContext` is `false` in
Chrome 150, Edge 150 and Chromium 148 (§4). So E0 carries the _mechanism_, feature-detected and
inert today, and gains a real consumer the moment the API lands.

```ts
registerAgentTools(tools: ToolDescriptor[]): { registered: boolean; dispose: () => void }
```

> **Revised 2026-07-28 during implementation.** This originally took a required `AbortSignal`.
> A required parameter only catches _"forgot to pass anything"_ — it does nothing about
> `registerAgentTools(tools, new AbortController().signal)`, which type-checks and leaks exactly
> as much as passing nothing. Owning the controller and returning `dispose` means a caller cannot
> forget to abort a controller it never created.

- Returns `false` and no-ops when `document.modelContext` is undefined. Never throws, never blocks
  startup, and is not part of the `AiState` machine — WebMCP availability is orthogonal to whether
  the _local_ model can run, and conflating them would let one break the other.
- **Unregistration is via `AbortSignal` only** — WebMCP has no `unregisterTool()`. E0 owns that
  lifecycle so consumers cannot leak registrations across route changes.
- `inputSchema` is JSON Schema — the _same shape_ `selectTool()` passes as `responseConstraint`.
  This is the reason to build both here: one descriptor type feeds local constrained decoding and
  remote agent registration, so they cannot drift.

The **descriptors themselves remain E's**, along with their `execute` implementations over
`@rainforest-dev/personal-data`. E0 defines only the `ToolDescriptor` type and the registration
plumbing.

## 9. Out of scope

- The tool catalog's contents and `execute` bodies — that is **E**, and the catalog must be shared
  with `src/mcp/profile.ts` so the remote MCP surface and the local palette cannot drift.
- Server-model fallback, streaming chat UI, multi-step agent loops — excluded by the chain spec.
- The task-specific APIs (`Summarizer`, `Translator`, `LanguageDetector`) — present in both Chrome
  and Edge stable per §4, and worth their own step later, but not part of this primitive.

## 10. Testing

- Core is framework-agnostic, so it unit-tests under Vitest with a stubbed `LanguageModel` global.
- Cover each ladder rung: absent global; `availability()` returning each value; a successful probe;
  and **a probe that fails after `ready`**, which is the transition most likely to regress.
- `enableModel()` outside a gesture must surface `NotAllowedError` rather than hanging.
- `registerAgentTools()` must return `false` and no-op with `document.modelContext` undefined —
  which is every browser today, so this is the default path, not an edge case.
- Real-browser behaviour is verified in D, not here.

## 11. Next step

Implementation plan for E0, then **E** (⌘K palette) consuming it.
