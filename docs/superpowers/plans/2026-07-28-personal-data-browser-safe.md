# Make `personal-data` Browser-Safe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let `@rainforest-dev/personal-data` run in a browser, by parsing frontmatter at build time instead of at runtime.

**Why now:** The ⌘K palette (E) executes catalog tools client-side. Every tool goes through `loader.ts`, which calls `gray-matter` at runtime — and `gray-matter` requires Node's `Buffer`. Result: **every ask throws `ReferenceError: Buffer is not defined` in every browser.** The palette degrades cleanly (its `try/catch` keeps search working) but the AI path can never return an answer.

**Second problem, same root cause:** `import.meta.glob(..., { query: '?raw' })` inlines raw **markdown** into the bundle, and the browser then needs a YAML parser to read it. The palette chunk is currently **364 KB** — larger than the Vue runtime. `libs/personal-data/vite.config.ts` already warns that the `index` entry "inline[s] the entire content dataset"; this is that warning coming true.

Parsing at build time fixes both: no `Buffer`, no YAML parser shipped, and JSON instead of markdown in the bundle.

---

## Approach

Replace the runtime `matter(raw)` call with a **Vite-time transform**, so `import.meta.glob` yields already-parsed `{ data, content }` objects.

Chosen over a codegen step that writes a generated file: `personal-data` is already Vite-built and `import.meta.glob` is already a Vite construct, so a transform adds no new coupling — whereas a generated artifact can go stale in dev between editing a markdown file and rebuilding. Vitest and Astro dev both run through Vite, so a transform stays correct in every context.

`gray-matter` moves from a runtime dependency to a **build-time only** one. It still does the parsing; it just does it once, during the build, in Node — where `Buffer` exists.

**If the transform approach turns out not to work** — e.g. `import.meta.glob`'s eager output can't be reshaped from a plugin in this Vite version — **stop and report BLOCKED** rather than forcing it. The fallback is a codegen step, and that is a different plan.

---

## Task 1: Pin current behaviour

Nothing changes yet. `loader.ts` is consumed by the MCP server, `llms.txt`, Astro SSR and now the palette; a parsing change that alters output would break all four silently.

**Files:** modify `libs/personal-data/src/loader.test.ts`

- [ ] **Step 1: Add characterisation tests**

Assert the _exact_ parsed shape for one entry of each collection kind — a markdown one with array frontmatter (`experiences/en/7.md` has `technologies` as an array and `startAt` as a date-like string) and the JSON collection (`organizations`). Assert `id`, every `data` field, and that `body` is the markdown **after** the frontmatter fence, with no leading blank line.

Include one entry whose frontmatter contains a **quoted date string** (`startAt: '2025-05'`) and assert it survives as whatever type it is today — do not "improve" it. A transform that silently starts producing `Date` objects where strings were expected would break `z.coerce.date()` consumers in a way tests must catch.

- [ ] **Step 2: Run — must PASS immediately**

`pnpm nx test personal-data --skip-nx-cache`

This describes existing behaviour, so it passes on first write. **If it fails, stop and report** — the current shape isn't what this plan assumes.

- [ ] **Step 3: Commit**

```bash
git add libs/personal-data/src/loader.test.ts
git commit -m "test(personal-data): pin parsed entry shapes before moving parsing to build time"
```

---

## Task 2: The build-time transform

**Files:** modify `libs/personal-data/vite.config.ts`, `libs/personal-data/src/loader.ts`

- [ ] **Step 1: Add the transform plugin**

In `vite.config.ts`, add a plugin that handles `.md` files imported with a dedicated query (e.g. `?frontmatter`), parsing with `gray-matter` at transform time and emitting a module whose default export is `{ data, content }`.

Comment it with _why_: parsing must happen in Node at build time because `gray-matter` needs `Buffer`, which browsers lack — and because shipping parsed JSON is smaller than shipping markdown plus a parser.

- [ ] **Step 2: Point the loader at it**

Change the markdown globs in `loader.ts` from `query: '?raw', import: 'default'` to the new query, and delete the runtime `matter()` call and its import. The JSON collection (`organizations`) is unaffected — it never used `gray-matter`.

- [ ] **Step 3: Move `gray-matter` to devDependencies**

In `libs/personal-data/package.json`. It is now build-time only. Run `pnpm install`.

- [ ] **Step 4: Verify**

```bash
pnpm nx test personal-data --skip-nx-cache
pnpm nx build personal-data --skip-nx-cache
```

Task 1's characterisation tests must **still pass unmodified**. If any fails, the transform changed the parsed shape — fix the transform, do not edit the test.

- [ ] **Step 5: Commit**

```bash
git add libs/personal-data
git commit -m "perf(personal-data): parse frontmatter at build time so the loader runs in a browser"
```

---

## Task 3: Prove it in a browser, and measure

**Files:** none — this is verification.

- [ ] **Step 1: Confirm the `Buffer` error is gone**

```bash
pnpm nx build personal-website --skip-nx-cache
pnpm nx dev personal-website
```

In the browser, open ⌘K and trigger an ask with the model enabled — or, if you'd rather not pull a multi-hundred-megabyte model, stub `LanguageModel.create` so `selectTool` returns a valid `{ tool: 'get_skills' }` and confirm the answer strip fills with a real sentence.

**Report exactly what you did and what you saw.** "Should work now" is not a result.

- [ ] **Step 2: Measure the bundle**

Before and after, record the size of the palette chunk:

```bash
ls -S apps/personal-website/dist/client/_astro/*.js | head -3 | xargs -I{} sh -c 'echo "$(du -h {} | cut -f1)  $(basename {})"'
```

It was **364 KB** for `CommandPalette.*.js`. Report the new figure. If it did not shrink, say so — the whole dataset may still be inlined for a different reason, and that is worth knowing rather than assuming.

- [ ] **Step 3: Full gates across the workspace**

Both the MCP path and the site consume this library, so check widely:

```bash
pnpm nx run-many -t test --all
pnpm nx run-many -t build --all
pnpm nx lint personal-website
pnpm format:check
```

Also re-verify the live MCP endpoint still returns all seven tools with correct payloads, since `loader.ts` is what feeds them:

```bash
curl -s -X POST http://localhost:4321/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_skills","arguments":{}}}' | head -c 400
```

- [ ] **Step 4: Commit any fixes, then report**

## Definition of done

- Task 1's characterisation tests pass unmodified.
- An ask in a real browser fills the answer strip with a sentence built from real records.
- The palette chunk is measurably smaller, with the figure reported.
- Every project's tests and builds pass; the MCP endpoint still serves all seven tools.
- `gray-matter` is a devDependency.
