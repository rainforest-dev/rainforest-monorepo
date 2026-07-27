# Browser-AI Chain on rainforest.tools — Decomposition Spec

- **Date:** 2026-07-27
- **Branch:** `claude/personal-website-career-279da1`
- **Status:** Decomposition approved in brainstorming; pending written-spec review → per-sub-project brainstorm cycles.

## 1. Goal & context

One request bundled six loosely-related pieces of work: refresh the stale career state on
rainforest.tools, take a career-evidence snapshot, publish a browser-AI survey post, build
interactive demos with an unsupported-browser fallback, ship a Prompt-API-powered ⌘K on the
personal site, and brainstorm further on-device-AI uses.

These are **independent projects**, not one feature. This file is the **sequencing and interface
source of truth** for the chain. Each sub-project gets its own design spec and implementation plan;
this document fixes only the order, the boundaries between them, and the shared primitive they must
not each reinvent.

### The finding that shaped this decomposition

The ⌘K work is **not a greenfield design problem**. A complete, firsthand architecture note already
exists at `notes/ai/on-device-ai-command-palette.md` in the private Obsidian vault (created
2026-07-08), written from prior hands-on implementation experience. It documents a four-layer
architecture and — more valuable — the hard limits observed live. E is therefore a **port of a
proven design**, which lowers its risk and moves the genuinely uncertain work into E0 (capability
detection and degradation) rather than into the palette itself.

Supporting research already in the vault: `notes/ai/browser-on-device-ai-baseline.md`,
`notes/wiki/pages/{tech-chrome-prompt-api,tech-gemini-nano,on-device-ai,tech-browser-ai,tech-generative-ui,tech-ai-sdk}.md`,
and two Readwise captures of web.dev's Prompt API articles (2024-10-26, 2025-01-21).

### Decisions locked in brainstorming

1. **Public stance (A):** add Angible to the public timeline, `2025-05` → present, with generic
   non-metric descriptions. Location Tainan → Taipei. Keep the recruiter funnel but soften
   *"actively seeking new employment opportunities"* → *"open to"*.
2. **Survey sourcing (C):** the vault notes and the work codebase are **research inputs only**. No
   new artifact is committed to any company repository. One public blog post is the sole output.
3. **Confidentiality (C, E):** generic transferable pattern only — see §6.
4. **Order:** A → E0 → E → D → C → B.
5. **Out of scope:** see §5.

## 2. Order and rationale

| Step | Sub-project | Why here |
|------|-------------|----------|
| **A** | Career state refresh | Independent of everything else; ships immediately. Its data feeds E's tools, so it must precede E. |
| **E0** | Capability primitive | Consumed by both E and D. Building it once is the entire point of this decomposition. |
| **E** | ⌘K command palette | The flagship. Port of the documented four-layer architecture. |
| **D** | Blog demos + recorded fallback | **The fallback recording cannot be produced until the feature works.** D's demos reuse E0, and the recording is captured from a working E. |
| **C** | Survey post | Written last so it documents what actually shipped, with live demos embedded, rather than describing an API landscape abstractly. |
| **B** | Career snapshot | **Blocked** — see §7. Nothing else depends on it, so it costs nothing to defer. Running it after E is a bonus: E changes the MCP surface that claim F1 concerns. |

Two deviations from the originally-requested A → B → C → D → E:

- **B moved to the end** because its tooling is unavailable and unfixable from within a session.
- **C moved after D/E** because the research spike is already complete; the remaining value in the
  post is documenting a working implementation.

## 3. E0 — the shared capability primitive

The single interface this document exists to fix. Without it, D and E each implement availability
detection and unsupported-browser messaging separately, producing two inconsistent experiences on
one site.

**Location:** `apps/personal-website/src/utils/ai/` — a `useLanguageModel()` composable plus an
`<AiCapability>` wrapper component exposing a fallback slot.

**Types:** `@types/dom-chromium-ai` is already a devDependency of `apps/personal-website`; the
`LanguageModel` global is typed. No `declare global` shim needed.

E0 owns every fragile concern:

| Concern | Required behaviour |
|---|---|
| Availability | Call `LanguageModel.availability()` → `unavailable \| downloadable \| downloading \| available`. Never infer support from API presence alone. |
| Browser gate | Exclude Edge via `!/Edg\//.test(ua)`. Edge exposes the same Prompt API backed by Phi-4-mini, whose `prompt()` accepts only `user`/`assistant` roles — the tool round-trip fails with `UnknownError: kErrorUnknown`. |
| Model download | `create({ monitor })` must be invoked **synchronously from a user gesture** or it throws `NotAllowedError`. Requires an explicit "download model" button and progress reporting. |
| Bounds | Wall-clock timeout plus a tight step cap (≈4). A higher cap lengthens the main-thread freeze window without improving capability. |
| Degradation | Named fallback slot rendering the recorded demo plus a plain explanation of why the live version is unavailable. |

**Consumers:** E (⌘K) and D (blog demos). Neither may call `LanguageModel` directly.

## 4. Per-sub-project scope

### A — Career state refresh

- **New:** `libs/personal-data/src/data/organizations/{en,zh}/angible.json`;
  `libs/personal-data/src/data/experiences/{en,zh}/7.md`.
- **Edit:** `apps/personal-website/locales/{en,zh}/common.json` (location, metadata description);
  `locales/{en,zh}/home.json` (hero summaries, organization label keys).
- **Likely unchanged:** `libs/personal-data/src/vocab.ts` — `auth0`, `nx`, `nextjs`, `playwright`,
  `vitest`, `typescript`, `fastapi`, `python`, `docker`, `terraform`, `github-actions` are all
  already in `skillTags`. Confirm during A's cycle before adding entries.
- **Updates for free:** the homepage experience list, `src/components/resume/ats-friendly.astro`,
  and the MCP server's `get_work_experience` / `get_profile_summary` output — all read the same
  content collections. No code change required.
- **Watch:** count assertions in `libs/personal-data/src/{loader,profile-data,schemas}.test.ts`.
- **Excluded content:** compensation, and any claim marked unverified in the private vault's career
  files, stay private. Internal operational metrics are not publishable — descriptions must be
  qualitative.

### E — ⌘K command palette

- Tool catalog extracted into a module **shared with `apps/personal-website/src/mcp/profile.ts`**,
  so the remote MCP surface and the local palette cannot drift apart.
- Tool `execute` implementations call `@rainforest-dev/personal-data`, which is statically bundled —
  so the palette is genuinely offline and has no tenant/auth scoping problem.
- Tool selection by native `responseConstraint` (JSON-Schema constrained decoding), one call per
  turn. A prompt-injection tool-calling polyfill was tried in the reference implementation and
  dropped; it was the source of malformed-JSON and multi-minute-freeze failures.
- Tools return typed view-models; the frontend owns all rendering. The model never emits UI.
- Consumes E0 for availability, download, gating, and fallback.

### D — Blog demos + recorded fallback

- `apps/personal-website/src/components/blog/demo/prompt-api/*`, built on E0.
- Produces the recorded demo asset used by E0's fallback slot, captured from a working E.

### C — Survey post

- New MDX post under `apps/personal-website/src/data/blog/`.
- Cross-linked from the existing `web-ai.mdx` (2024-12-28), whose commented-out
  `{/* <WebLLM api="prompt-api" client:load /> */}` section is finally resolved.
- Sources: the vault wiki cluster, the two Readwise web.dev captures, and public Chrome/spec docs.

### B — Career snapshot

Run per the `career-snapshot` skill once §7's blocker is cleared. Window starts `2026-07-04`
(previous `window_end`).

Note for that run: claim **F1** (`mcp.rainforest.tools` 有實質進展) should be re-worded before it is
judged. `apps/personal-website/src/pages/mcp.ts` documents that the root route exists specifically
*because* the `mcp.rainforest.tools` host rewrite does not reliably take effect ahead of Astro's
generated routing. The server is real and reachable at `rainforest.tools/mcp`; the hostname is the
part that does not work. As literally worded, F1 is closer to **PARTIAL** than **NOT-FOUND**.

## 5. Out of scope (YAGNI)

Excluded by the documented limits of on-device Gemini Nano, not by preference:

- **Server-model fallback.** The AI SDK transport seam makes this swap cheap later; it is not needed
  to ship.
- **Multi-step agent loops.** Multi-call turns are unreliable; raising the step cap does not help.
- **Non-English output.** Output is English-mostly and non-English replies are flaky. A Chinese
  summarizer is explicitly *not* a viable on-device feature.
- **Streaming chat UI / AI SDK dependency.** One constrained call per turn does not require a
  streaming chat framework. Revisit only if E's own cycle proves otherwise.
- **Any new artifact in a company repository.**

Further on-device-AI ideas (the original request's "brainstorm other usages") are deliberately
folded into **E's brainstorm cycle**, where they can be evaluated as *single-call, English,
single-tool* features against real constraints instead of speculatively.

## 6. Confidentiality boundary

The reference implementation is work product in a company repository. The boundary agreed in
brainstorming:

**Publishable** — the Prompt API surface; `responseConstraint` versus prompt-injection tool-calling
polyfills; the Edge/Phi-4-mini `tool`-role trap; the user-gesture download requirement; main-thread
jank; context-window pressure; and the criteria for switching to a server model. These are
properties of a public web API.

**Not publishable** — the employer name in connection with this work, the product domain, internal
identifiers, PR/branch references, internal metrics, and any code. The personal site's palette is
built independently against `@rainforest-dev/personal-data`.

## 7. Blockers and assumptions

**B is blocked on tooling that no owned machine provides.** Verified 2026-07-27 across both
machines:

- **Slack:** no Slack MCP server is configured on `rainforest-mini` or on the work laptop, and Slack
  does not appear in the laptop's `mcp-needs-auth-cache.json`. The `career-snapshot` skill's Slack
  collector cannot run, so claim **F3** (Three-MCP ADR 導讀, a Slack-channel event) is unverifiable
  from any current environment. **Action required: add a Slack MCP server.**
- **Notion:** this machine's Notion connector points at a **personal** workspace, not the company
  one. Per the skill's own rule, only the company Notion counts for **F2**. That workspace
  additionally reports `query_meeting_notes: upgrade_required`, disabling the skill's
  meeting-enumeration step. The work laptop's docker MCP gateway lists a `notion-remote` server
  which may reach the company workspace — **verify in step 0 of B's run.**
- **GitHub:** usable, with care. `gh` is authenticated for both `rainforest-dev` (active) and the
  company account; company queries require switching first. The local company clone's newest commit
  is `2026-04-01`, so it cannot cover the window without fetching.

**Remote access does not resolve any of this.** The work laptop is reachable and was checked
directly; it has the same Slack gap. Connectivity was never the constraint — the missing tooling is.

Two SSH host aliases exist for the laptop by design, one per network path (company VPN, mesh VPN);
whichever network the client is on, one of them applies. Note only that the **mesh alias's address
is out of date** — the laptop re-registered under a new node name at a new address, so that alias
times out even while the machine is online. Worth refreshing independently of this work.
(Addresses and identifiers deliberately omitted: this repository is public.)

**Vault access:** no remote access needed for research. The local vault copy is *ahead* of the
laptop's (`2026-07-27` vs `2026-07-24`) and contains every relevant note.

## 8. Next step

Brainstorm **A** (career state refresh) as its own cycle → design spec → implementation plan →
implementation.
