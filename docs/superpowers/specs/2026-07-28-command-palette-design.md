# ⌘K Command Palette (E) — Design Spec

- **Date:** 2026-07-28
- **Branch:** `claude/command-palette`, stacked on `claude/ai-capability-primitive` (E0, PR #257)
- **Status:** Design approved in brainstorming; pending written-spec review → implementation plan.
- **Chain:** step **E** of [2026-07-27-browser-ai-chain-design.md](./2026-07-27-browser-ai-chain-design.md). A is merged (#255); E0 is PR #257.

## 1. Goal

A command palette on rainforest.tools that is **useful to everyone and better with on-device AI**.
Deterministic search always works; the Prompt API is an upgrade that adds natural-language
querying, never a prerequisite.

It is also the first real consumer of E0, and the place where the tool catalog behind
`rainforest.tools/mcp` stops being duplicated.

### Decisions locked in brainstorming

1. **Answer strip above the results.** A short answer sits above the actual records it came from,
   so a claim and its evidence are visible together.
2. **One Zod-first catalog, two adapters.** `zod@3.25.76` ships the v4 implementation under the
   `zod/v4` subpath, and `z.toJSONSchema()` works there — verified — so Zod → JSON Schema needs no
   new dependency. The reverse direction would need a library and is lossy.
3. **No answer strip in `zh`.** E0 pins output to English because non-English replies are
   unreliable on current on-device models. Rather than show English prose above Chinese records,
   `zh` gets search only.
4. **`↵` activates the selected row.** Typing never triggers inference.
5. **The strip is templated from real results.** The model selects a tool; it does not write prose.

## 2. Behaviour

`⌘K` / `Ctrl+K` opens from anywhere. Typing runs deterministic search over
`@rainforest-dev/personal-data` — experiences, projects, skills, blog posts. That path never
touches the model.

The row list differs by capability; **the keyboard rule does not**. `↑↓` moves, `↵` activates.

| Condition                             | Row 0             | Remaining rows |
| ------------------------------------- | ----------------- | -------------- |
| AI ready, locale `en`                 | `Ask: "<query>"`  | search results |
| AI absent / unavailable / locale `zh` | top search result | search results |

So `↵` on a fresh query asks when asking is possible and opens the top hit when it is not, without
`↵` ever meaning two things in the same list. This is the reason to model it as _rows_ rather than
as modal Enter behaviour: one rule, different rows.

Activating the ask row runs **one** `selectTool()` call, executes the chosen tool locally against
bundled data, and renders the strip. Nothing is streamed and no second call is made.

**Enabling the model.** The download must start from a real user gesture or the platform throws
`NotAllowedError`. The enable control therefore lives in `AiCapability`'s `downloadable` slot as a
button — it cannot be triggered by opening the palette or by typing.

## 3. The catalog

The substantive part. Today `src/mcp/profile.ts` registers each tool inline with Zod params and an
MCP content envelope, and `PROFILE_MCP_TOOLS` separately repeats every name and description for
`llms.txt`. The palette would be a third copy.

New `src/mcp/catalog.ts`, one definition per tool:

```ts
export interface ProfileTool<
  TArgs = Record<string, unknown>,
  TResult = unknown,
> {
  name: string;
  description: string;
  /** Zod raw shape — what the MCP SDK's registerTool expects. */
  params: ZodRawShape;
  /** Plain data. No MCP envelope, no formatting. */
  run: (args: TArgs) => Promise<TResult>;
  /**
   * One line for the answer strip, composed from `run`'s actual result.
   * Returns null when there is nothing worth saying. No model involved.
   */
  summarise: (result: TResult, args: TArgs) => string | null;
}
```

Three surfaces derive from it, none hand-maintained:

| Consumer                         | Derivation                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `registerProfileMcp(server)`     | wraps `run()` in `{ content: [{ type: 'text', text: JSON.stringify(...) }] }`                                                            |
| `toToolDescriptors()`            | `inputSchema` via `z.toJSONSchema(z.object(params))` from `zod/v4`; `execute: run`. Feeds both `selectTool()` and `registerAgentTools()` |
| `PROFILE_MCP_TOOLS` (`llms.txt`) | name + description, derived rather than repeated                                                                                         |

`summarise` is E's addition and the reason the strip can be truthful. It lives **with** the tool,
so a new tool cannot ship without deciding how it reads.

## 4. The answer strip

The model's only job is choosing a tool and its arguments, under `responseConstraint`. The
sentence comes from `summarise(result, args)` — composed from records that exist.

This makes a wrong answer structurally impossible in a way review cannot guarantee: there is no
generated text about the author's career anywhere on the page. It also keeps the interaction to
one call, which is the only pattern the on-device model handles reliably.

If `summarise` returns `null`, the strip is omitted and results render alone.

## 5. Search

Hand-rolled matcher in `src/utils/search.ts`. No fuzzy-search dependency: the entire corpus is
roughly seven experiences, four projects, fifteen skills and a handful of posts — small enough
that a scored substring/prefix match over a few hundred rows is both sufficient and instant.

Search is pure, synchronous and independently testable, with no dependency on `src/utils/ai/`.

## 6. Files

- **New:** `src/mcp/catalog.ts`, `src/utils/search.ts`, `src/components/shell/CommandPalette.vue`
- **Modified:** `src/mcp/profile.ts` (becomes a thin adapter), `src/pages/llms.txt.ts` and
  `llms-full.txt.ts` (derive the tool list), the site layout (mount the palette)

## 7. Risk: this refactors live, shipped code

`src/mcp/profile.ts` currently serves `rainforest.tools/mcp` in production. Extracting the catalog
must preserve tool names, descriptions, argument shapes and output payloads exactly, or remote MCP
clients break **silently** — nothing on the site would look wrong.

**Mitigation, and it is a hard requirement of the plan:** write characterisation tests that pin the
current MCP tool list and each tool's output shape _before_ touching `profile.ts`, so the refactor
is provably behaviour-preserving rather than merely believed to be.

## 8. Out of scope

- Generated prose, streaming, multi-step or retry logic — excluded by E0's measured limits.
- A `zh` answer strip. Revisit only if on-device Chinese output becomes reliable.
- Server-model fallback.
- Search ranking sophistication beyond scored matching; the corpus does not justify it.

## 9. Next step

Implementation plan for E, beginning with the characterisation tests from §7.
