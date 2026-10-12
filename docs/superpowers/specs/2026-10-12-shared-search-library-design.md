# Shared search library: design

Date: 2026-10-12. Branch `claude/shared-search-library-design-c671a2`, from `main` at f6cf71a5.

## Goal

Four products search their own data, and each grew its own search code. Between them they hold five
lexical scorers, two Ollama clients, three hash-keyed reuse implementations, a React and a Vue
wrapper around the same Prompt API flow, and a hand-written prompt JSON Schema beside a zod schema
for the same query. This work moves the shared parts into libraries once:

- `@rainforest-dev/search` (new): a framework-free core, plus a `./node` entry for index files and
  Ollama.
- `@rainforest-dev/web-ai` (extended): a framework-free AI controller and a Prompt API query parser
  with a local fallback.

personal-memories, which holds the reference implementation, migrates first with no behaviour
change. Then personal-calibre gains semantic search, including in its MCP tool. Then rss-manager
moves to the shared lexical matcher. Then the personal website gains offline-computed semantic
neighbours, and a measured spike decides whether in-browser query embedding is worth adding.

## Owner decisions this design follows

Decided 2026-10-11 and 2026-10-12:

- One package with two subpath entries. `.` is pure and runs anywhere, and `./node` holds
  everything that touches `node:` or makes HTTP calls to Ollama. Three separate packages would give
  the same separation with three builds to maintain. The browser half extends web-ai.
- personal-calibre gains semantic search through Ollama, in its search box, its list page and its
  MCP `list_books` tool.
- The website ships offline-only features now (shared lexical, expansions, offline semantic
  neighbours). In-browser query embedding is a gated spike, and its result becomes a blog post
  whatever it finds.
- Website data changes rarely, so as much as possible is computed offline and committed. The
  browser does only lookups.
- The Vercel AI SDK is not used as the foundation (see "Vercel AI SDK, considered").

## Hard constraint: the public website never reaches a private host

`personal-website` runs on Vercel and is public. At build time and at run time it must never contact
the homelab, Ollama or any private host, and no tunnel or endpoint may be exposed publicly for it.
Every artifact that needs Ollama is generated on the dev machine, committed, and checked by a
freshness test that runs without Ollama. Two guards enforce this:

1. Lint: `no-restricted-imports` forbids `@rainforest-dev/search/node` under
   `apps/personal-website/src/**`. `apps/personal-website/scripts/**` may import it.
2. Build-output test: after `build`, scan the client and server output for `:11434`, `/api/embed`,
   `/api/chat`, `.ts.net`, `.local`, and RFC 1918 addresses (`10.`, `172.16–31.`, `192.168.`), and fail
   on any hit. Only generic patterns are written down, never a real homelab hostname, because the
   repository is public.

In the W2 spike the visitor's browser may download public model weights from Hugging Face, a public
service, and only after the visitor opts in. That stays within the constraint.

## What exists today (verified 2026-10-11)

- memories: `lib/search/{lexical,terms,text,vector,rrf}.ts`; `lib/server/search-files.ts`
  (`docs.json` + `vectors.text.bin`, FNV-1a `vectorsHash`, `reuseVectors` with `retry`);
  `lib/server/embed.ts` (Ollama client, model table, typed `EmbedError`, `withQueryPriority`, env
  `MEMORIES_OLLAMA_URL` / `MEMORIES_EMBED_MODEL` / `MEMORIES_EMBED`); `lib/server/search-index.ts`
  (800 ms query timeout, 30 s breaker, `minScore` floor, RRF, `byDay`); `lib/server/note-vectors.ts`
  (a second hash reuse); `cli/ingest.ts` `buildIndex` (partial progress, retry for unreadable
  images); `components/chrome/prompt-parse.ts` and `usePromptParse.ts` (Prompt API parse, 1500 ms
  timeout, local fallback); `lib/search-schema` (zod from `astro/zod`, `z.toJSONSchema`), which the
  prompt path does not use because it needs a per-request `people` enum.
- calibre: `app/api/books/search/route.ts` (FTS5 trigram, then an in-memory n-gram fallback);
  `db/client.ts` `syncBooksFts` (tracks Calibre `last_modified`); `lib/server/book-query.ts`
  `buildBookConditions` uses SQL `LIKE`, which both the list page and MCP `list_books` go through.
- rss-manager: `lib/desk/filters.ts` `matchesSearch` and `lib/desk/topics.ts`
  `matchesTopicSearch`, both whole-string lowercase substring tests.
- website: `utils/search.ts` (`scoreMatch`, tiers 100/75/50/30/15/5); `scripts/expand-search-keywords.ts`
  (Ollama `/api/chat`, env `OLLAMA_URL` / `OLLAMA_MODEL`); `utils/search-expansions.ts`
  (sha256/16 `hashRecord`, `planExpansion`); `scripts/search-expansions-freshness.test.ts`;
  `utils/ai/use-language-model.ts` (Vue wrapper) and `components/shell/CommandPalette.vue` (tool
  routing with `SELECTION_SCHEMA`); MCP `search_by_technology` (substring).
- `astro/zod` and `zod` both resolve to zod 4.6.5. Every schema's `~standard` has `validate` and
  `jsonSchema.input({ target })`. Probed output differs from `promptSchema()` in three ways: a
  `$schema` key, `maxLength` from `.max()`, and `z.iso.date()` emitting `format: "date"` with a
  leap-year regex instead of `^\d{4}-\d{2}-\d{2}$`.
- memories' CLI runs under plain `node`, so any workspace library it imports must load from `dist`
  as plain ESM.

Corrections to the brief: the website palette is Vue, not React. The fifth scorer is rss-manager's
topic filter. calibre's `LIKE` is a sixth matcher.

## Package layout

| Piece                                                                                                                                                                          | Package                  | Entry    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | -------- |
| fold, terms, matchers, rank, RRF, topK, `semanticIds`, `Embedder`, `EmbedError`, breaker, `embedQuery`, `withQueryPriority`, hashes, `planReuse`, index header type and checks | `@rainforest-dev/search` | `.`      |
| index file read/write, `ollamaEmbedder`, model table, `ollamaChat`, `assertModel`, `conceptEmbedder`                                                                           | `@rainforest-dev/search` | `./node` |
| `createAiController`, `createQueryParser`, `queryLanguage`, `languagesFor`, `statusFor`, `optInSwitch`                                                                         | `@rainforest-dev/web-ai` | `.`      |

Package rules from CLAUDE.md apply: libraries are framework-free; consumers import only the root or
a declared subpath; imports inside `libs/*` stay relative; no barrel mixes server and browser code.
The `.` entry has no `node:` import, and a lint rule in `libs/search` forbids one outside
`src/node/`. Dependencies are declared as `workspace:*`, and consumers keep `dependsOn: ["^build"]`.
`libs/search` is scaffolded with the `nx-generate` skill, using the same vite multi-entry and
`vite-plugin-dts` setup as `libs/mcp-kit`.

The library takes options, never environment variables. Each app maps its own env:

- memories: `MEMORIES_OLLAMA_URL`, `MEMORIES_EMBED_MODEL`, `MEMORIES_EMBED`.
- website scripts: `OLLAMA_URL`, `OLLAMA_MODEL`.
- calibre (new): `CALIBRE_OLLAMA_URL`, `CALIBRE_EMBED_MODEL`, `CALIBRE_EMBED=fake` for tests.

No deployment setting changes for an existing app.

## Core: `@rainforest-dev/search`

Every function is first moved verbatim with its existing tests. A generalised version replaces the
original only after a golden test shows identical output.

### Text

- `fold(s)`: `s.normalize('NFKC').toLowerCase()`.
- `trimEdges(token)`, `queryTerms(text)`: moved from memories unchanged.

### Matchers and rankers

The five scorers implement three different ranking models. Merging them into one would change at
least two products, so the core offers three named functions on one `fold`:

- `matchesAllTerms(fields, terms)`: every term occurs in some field after folding. Used by
  rss-manager, and by `lexicalRank` internally.
- `lexicalRank(docs, terms, config)`: memories' ranking. `config` gives `id(doc)`, `text(doc)`,
  `facets` (each `{ values(doc), match: 'exact' | 'substring' }`) and `tieBreak(a, b)`. Order: facet
  hits, then text hit count, then `tieBreak`. memories passes people as `exact`, places as
  `substring`, and `day desc, id asc` as the tie-break, and must get today's output exactly.
- `tieredMatch(query, { title, keywords, expanded })`: the website's tiers, unchanged except that
  folding replaces `toLowerCase`.
- `ngramSimilarity(query, target)`: calibre's bigram-plus-trigram coverage, unchanged, including its
  plain `toLowerCase`.
- `whitespaceTerms(text)`: fold, split on whitespace, drop empties, dedupe. Unlike `queryTerms` it
  keeps edge punctuation, so `c++` stays `c++`.

### Vectors and fusion

- `topK(vectors, dims, query, k, allow?)` and `rrf(rankings, k = 60)`: moved unchanged.
- `semanticIds({ hits, minScore, k })`: applies the floor, sorts by score desc and then id asc, and
  truncates. This is the shared tail of memories' `semanticRank`, and calibre uses it too.

### Embedding contract

None of these touch `node:`, so they live in the core:

- `type Embedder = { model; dims; minScore; images; embed(inputs, kind, signal?) }`, with
  `EmbedKind = 'query' | 'document'` and `EmbedInput = string | { text; image }`.
- `class EmbedError` with `reason: 'ollama-unreachable' | 'timeout' | 'model-mismatch' | 'image-unreadable'`.
- `breaker(ms = 30_000)`, `embedQuery(embedder, text, timeoutMs = 800)` (validates length and
  finiteness), `withQueryPriority(embedder)`.

The interface is shaped so an AI SDK `EmbeddingModel` could be wrapped later. That adapter is not
built now.

### Hashes and reuse

- `fnv1a(text)` and `fnv1aBytes(bytes)`: moved unchanged. Their output format (`%08x`, and
  `${length}:${hex}` for bytes) is part of memories' on-disk format.
- `planReuse(previous, current)`: `previous` is `{ id, hash, retry? }[]` and `current` is
  `{ id, hash }[]`. It returns `{ reuse: Map<currentIndex, previousIndex>, missing: number[] }`.
  Entries marked `retry` are never reused. The caller decides compatibility (same model and dims)
  before calling, and chooses the hash function: memories and calibre use FNV-1a, the website keeps
  sha256/16. No existing file becomes stale.

### Index header

`type IndexHeader = { model; dims; docs: { id; contentHash; retry?: true }[] }`, plus
`isIndexHeader(value)`, an expected-length check (`docs.length × dims × 4` bytes) and the
`vectorsHash` comparison. The JSON field names and the `vectorsHash` format are exactly those of
today's `docs.json`.

## Server: `@rainforest-dev/search/node`

- `readIndexFiles(dir, names?)` / `writeIndexFiles(dir, header, vectors, names?)`: atomic `.tmp`
  plus `rename` writes, with default names `docs.json` and `vectors.text.bin`. The returned
  `Float32Array` is realigned when the buffer offset is not a multiple of four, as now. A fixture
  pair written by today's code is committed to `libs/search` and must read back identically.
- `ollamaEmbedder({ url, model, dims, minScore, fetch })`: moved from memories with its model table
  (`embeddinggemma-2:440m-bf16-text-vision`: `minScore` 0.705, images; `embeddinggemma`: 0.25, text
  only), its query and document prefixes, image reading, `keep_alive: '24h'`, and every
  `EmbedError` path.
- `ollamaChat({ url, model, format, messages, think?, temperature? })` and `assertModel(url, model)`:
  extracted from the website's expansion script (`/api/chat` with a JSON Schema `format`, then
  `/api/tags`).
- `conceptEmbedder(concepts)`: memories' `fakeEmbedder`, taking its concept list as an argument.

## Browser: `@rainforest-dev/web-ai` additions

web-ai is browser-only, so the new modules export from its root.

### `createAiController()`

memories' `usePromptParse` and the website's `useLanguageModel` both implement detect, enable on
click with download progress, run, re-detect after failure, and `acquire()`/release. The controller
holds that flow once:

- `getState(): AiState`, `subscribe(listener): () => void`
- `refresh(languages?)`
- `enable(languages?)`: must be called synchronously from a click handler, as `enableModel` already
  requires.
- `run<T>(prompt, jsonSchema, { signal?, languages? })`: delegates to `selectTool` and refreshes
  state on failure.
- `retain()`: wraps `acquire()` and returns its release function, so a consumer retains the shared
  session only while it is active.

React consumers read it with `useSyncExternalStore`, and Vue consumers with a `ref` updated in
`subscribe`. Each adapter stays in its app and shrinks to a few lines. Neither framework enters
web-ai.

### `createQueryParser<T, Ctx>(config)`

- `schema(ctx)`: returns a schema implementing both `StandardSchemaV1` and `StandardJSONSchemaV1`.
  It is a function because memories needs the current roster's ids as an enum, so memories builds
  and memoises a zod schema per roster. The JSON Schema sent as `responseConstraint` comes from
  `~standard.jsonSchema.input()`. Output is checked with `~standard.validate`, which replaces the
  hand-written `toSearchQuery`.
- `prompt(raw, ctx)`, `local(raw, ctx)`: app-supplied. memories passes `buildPrompt` and
  `localParser`.
- `languages(raw)`: defaults to `languagesFor(queryLanguage(raw))`.
- `timeoutMs`: default 1500.
- `parse(raw, ctx, ai, signal?)` returns `{ value: T; status: 'ai' | 'ai-timeout' | 'local' }`,
  with today's timeout and abort behaviour.

Also moved: `queryLanguage` and `languagesFor` (Han detection), `statusFor` (capability plus switch
to status, with `lang: string`), and `optInSwitch(key)` (localStorage with every access in
try/catch). The Chinese status copy stays in memories. The library returns states, never copy.

### Schema change risk in memories

A zod-derived JSON Schema is not byte-identical to today's `promptSchema()`. `z.iso.date()` emits
`format` as well as `pattern`, and Chrome's handling of `format` under constrained decoding is
unverified. `z.string().max(200)` rejects where today's code truncates. memories therefore migrates
in two steps:

1. Move the code onto `createQueryParser`, still passing the hand-written schema. There must be no
   observable change.
2. Switch to the zod schema. `text` uses a truncating transform, and the JSON Schema is taken from
   the input side. The generated schema must match `promptSchema()` field by field: `people` is
   omitted when the roster is empty, and dates use `pattern`. Every existing prompt-parse test must
   pass, and one manual run in real Chrome must parse a zh and an en query correctly. If any of this
   fails, keep the hand-written JSON Schema and use zod only for validation.

The website's `SELECTION_SCHEMA` picks which tool to run. It stays in `CommandPalette.vue`, now
running on the controller.

## Per product

### personal-memories: first, no behaviour change

- Delete `lib/search/{lexical,terms,rrf,vector}.ts` and the hash in `text.ts`. Keep `docs.ts`,
  `query.ts` (`localParser`) and `clipSnippet`.
- `embed.ts` keeps only the env mapping and `sharedEmbedders()`.
- `search-files.ts` uses `./node` index files, and `reuseVectors` is built on `planReuse`.
  `note-vectors.ts` keeps its per-id cache: it compares one hash per id in memory and has no
  previous file to plan against.
- `search-index.ts` uses the core's `embedQuery`, `breaker` and `semanticIds`. `byDay`, the note
  merge and `handleSearch` stay.
- prompt-parse moves in the two steps above. `usePromptParse` becomes a thin hook on the
  controller.
- The MCP `search_memories` tool is unchanged.
- Acceptance: every existing unit and e2e test passes unmodified. A golden test, written and passing
  before the migration, runs `runSearch` over a fixed fixture and compares the full response. Today's
  index files read back unchanged. Running `node src/cli/ingest.ts` with `MEMORIES_DATA_DIR` unset
  must exit with code 2 and its "MEMORIES_DATA_DIR is not set" message, not `ERR_MODULE_NOT_FOUND`.
  That proves the `dist` imports resolve under plain node without reading any data.

### personal-calibre: semantic search, including MCP

- Search doc per book: title, authors, series, tags, and Calibre `comments` with HTML stripped and
  clipped to 1,000 characters. `contentHash` is FNV-1a over that text.
- Index: whenever `syncBooksFts` sees a new `last_modified`, a background job embeds the missing
  rows with the background half of `withQueryPriority`, and writes `search/` index files under the
  app data directory. Partial progress is kept and resumed on the next sync. With no
  `CALIBRE_OLLAMA_URL` the job does not run.
- `searchBookIds(q)` in `lib/server/search` returns `{ ids, semantic: 'on' | 'off', reason? }`. It
  takes the lexical order from FTS5 (for queries of three or more characters) and the n-gram
  fallback as today, the semantic order from `embedQuery` plus `topK` plus `semanticIds`, and fuses
  them with `rrf`. A query shorter than two characters returns no ids. With Ollama unset,
  unreachable, timed out or behind an open breaker, `ids` equals today's lexical order exactly.
- Search route: the first 20 of `searchBookIds`. The response gains `semantic` and `reason`, in the
  same shape as memories.
- List page: `q` becomes "id in `searchBookIds(q).ids`", intersected with the other conditions, and
  the page passes its current sort explicitly, so ordering does not change. A query of one or two
  characters keeps today's `LIKE`, since trigram FTS cannot serve it.
- MCP `list_books`: with `query` and no `sortBy`, results are ordered by relevance; with `sortBy`,
  matched books are sorted by that field. `groupBy` groups the matched books. Output gains
  `semantic` and `reason?`, as in `search_memories`, so an agent can tell a lexical-only answer from
  an empty library. Pagination slices the ranked ids, and `total` is the number of matches. The
  description says the query is full-text plus semantic, ordered by relevance unless `sortBy` is
  set, and lexical-only when the embedding service is unreachable.
- All of this sits behind the `lib/server` barrel and never reaches the client bundle.
- Behaviour change, argued: the search box, the list page and MCP now agree on the same query, and
  CJK and multi-word queries stop missing books that `LIKE` could not match.

### rss-manager: shared lexical only

- `matchesSearch` and `matchesTopicSearch` use `whitespaceTerms` and `matchesAllTerms`. They do not
  use `queryTerms`, whose edge trimming would turn `c++` into `c` and widen single-word results.
- Behaviour change, argued: a multi-word query now needs every word to match somewhere, instead of
  the whole string matching as one substring, so multi-word queries find something. NFKC folding
  lets full-width input match. A test locks single-word results to today's.
- Facet counts and sorting do not change. There is no semantic search: the corpus is a few hundred
  sources and topics.

### personal-website

#### W1, shipped

- `scoreMatch` becomes the core's `tieredMatch`, with the same tiers. All existing search tests
  pass.
- `planExpansion` is built on `planReuse` with the sha256/16 hash. `search-expansions.json` is not
  regenerated, and the freshness test keeps its meaning.
- `expand-search-keywords.ts` uses `ollamaChat` and `assertModel`, and still reads `OLLAMA_URL` and
  `OLLAMA_MODEL`.
- `useLanguageModel` runs on the controller.
- MCP `search_by_technology` uses `fold`, so it agrees with ⌘K.
- Both guards from "Hard constraint" are added.

#### W1.5, offline semantic neighbours, shipped

- On the dev machine, a script embeds every palette record and a vocabulary with Ollama
  EmbeddingGemma 2. The vocabulary is the words of every title, every keyword, and every expansion
  term, in both languages.
- For each vocabulary term it keeps the top 8 records by cosine above a floor. The floor is
  calibrated for this data and stored in the file. memories' 0.705 was tuned for its own prefixes
  and corpus, so it does not carry over.
- Output: `src/data/search-neighbours.json` with `model`, `floor`, per-record hashes (sha256/16, as
  expansions), the vocabulary hash, and `terms: { [term]: [recordId, score][] }`. Vectors are not
  committed. They live in a gitignored local cache, and the script recomputes whatever is missing.
- Run time: fold the query and look up matching vocabulary terms (exact or prefix). Their
  neighbours become one ranking, which `rrf` fuses with the `tieredMatch` ranking. It is
  synchronous, and the file is a few tens of kilobytes.
- Freshness test: a changed record or vocabulary term without a regenerated file fails CI, and the
  failure prints the regenerate command, as the expansions test does.
- Example: "資料庫" hits a vocabulary term from the PostgreSQL record's expansions, and its
  neighbours also bring in database projects that never list that word. Expansions alone find only
  the PostgreSQL record.
- No model runs in the browser, so no quantisation gap exists, and the offline side can use the best
  model available.

#### W2 spike: is open-vocabulary query embedding worth it?

- Baseline: W1 plus W1.5.
- Candidates: EmbeddingGemma 300m ONNX q4f16 (about 175 MB) through `@huggingface/transformers`,
  and one multilingual static-embedding model (model2vec style). Document and query vectors come
  from the same ONNX file: documents through transformers.js in Node on the dev machine, queries in
  the browser after an explicit click, on WebGPU with a WASM fallback. Document vectors are
  truncated to 256 dimensions (Matryoshka) and stored as int8.
- Query set: 30 fixed queries, mixed zh and en, at least 10 of them outside the W1.5 vocabulary.
- Adopt only if every gate passes:
  - download ≤ 200 MB;
  - first query after load ≤ 300 ms p50, and warm queries ≤ 50 ms p50, on Apple Silicon with
    WebGPU;
  - on the out-of-vocabulary queries, more top-5 hits than the baseline, and no regression on any
    query the baseline already answers.
- Output: a report in `docs/superpowers/specs/` written in the shape of a post (problem, method,
  numbers, conclusion), and a draft blog post outline in `apps/personal-website`, left unpublished.
  The post is worth writing even if the answer is "offline lookups were enough". Spike code is
  thrown away. Adoption, if any, gets its own spec and plan.

## Vercel AI SDK, considered (2026-10-12)

- `ai` 7.0.137 provides `embed`, `embedMany`, `cosineSimilarity`, retries and `abortSignal`. Storage
  and retrieval are left to the caller. Lexical ranking, RRF, packed-vector topK, index files, hash
  reuse, the breaker, query priority and per-model floors are all outside it.
- Ollama has only community providers (`ollama-ai-provider-v2`, `ai-sdk-ollama`). Their docs do not
  cover image inputs to embeddings or `keep_alive`, and memories sends `{ text, image }`.
- `@browser-ai/core` 3.0.4 (formerly `@built-in-ai/core`, peer `ai@^7`) maps JSON output to
  `responseConstraint`, reports download progress, and passes `abortSignal` through. It sets no
  input or output languages, puts no timeout on `availability()`, treats `downloadable` no
  differently, never degrades after a failed first call, and caches one session per model instance
  regardless of options. web-ai handles each of these. Its embeddings are MediaPipe's Universal
  Sentence Encoder, loaded by default from the author's own bucket, and are incompatible with
  EmbeddingGemma vectors.
- Revisit when `@browser-ai/core` supports language options and bounds its probe, or when a product
  needs provider-swappable chat.

## Rollout

Execution runs through the `rainforest-core:loop` dispatcher. A run is capped at 40 turns and
USD 10, and the dispatcher has no notion of dependencies, so the work is cut into task notes
that each fit one or two runs and each open one PR. Only the next note in the chain is approved,
after the previous PR has merged. This replaces the single "libs plus memories" PR: the library
lands first with its own tests and the committed format fixture, and memories adopts it in the
next PR.

1. `libs/search`: core and `./node`, with the today-format index fixture.
2. memories adopts `libs/search`. Commits, in order: golden tests; core swap; `./node` swap.
3. web-ai controller and query parser; memories prompt-parse step 1, then step 2, as separate
   commits.
4. calibre: `searchBookIds`, background indexing, search route.
5. calibre: list page, MCP `list_books`, e2e.
6. rss-manager: `whitespaceTerms` and `matchesAllTerms`, e2e.
7. website W1: `tieredMatch`, `planReuse`, `ollamaChat`, controller, both guards.
8. website W1.5: offline semantic neighbours. It needs Ollama on the machine that runs it, reading
   `OLLAMA_URL` and a new `OLLAMA_EMBED_MODEL` (default `embeddinggemma-2:440m-bf16-text-vision`).
   With Ollama unreachable the run stops as blocked.
9. website W2: the spike report and draft post outline, with no code kept. Browser runs use
   Playwright's Chromium in new-headless mode on the real GPU, never a headed browser.

## Testing

- Library units with Vitest 4: node environment for `libs/search`, jsdom for web-ai. App tests for
  moved code move with it, and only product-specific tests stay in the apps.
- Golden tests in memories (`runSearch` over a fixture) and in `libs/search` (a today-format index
  pair). Both are written and green before the code they protect is moved.
- Playwright: memories-e2e search specs unchanged. calibre-e2e adds `CALIBRE_EMBED=fake` cases for
  a semantic hit and for an Ollama failure that falls back to lexical. rss-manager-e2e adds a
  multi-word query. The website extends `CommandPalette.test.ts` with neighbour hits.
- `nx affected -t smoke-artifact` must pass for memories, calibre and rss-manager, which proves the
  bundled Docker artifacts resolve the new workspace library.
- The website's lint guard and build-output scan.

## Session constraints

- Never run ingest, and never touch `~/.local/share/memories`: a full re-embed may be running on the
  Mac mini. calibre index tests use temporary directories only.
- `pnpm nx` targets only. Dependencies as `workspace:*`.
- No `Refs:` trailer. No real names in code, tests, fixtures, PRs or screenshots. memories fixtures
  use the fictional people already in `src/cli/fixture.ts`.
- Comments follow the allow-list in the user instructions. Check the diff for added comments before
  every commit.
- The worktree has no `node_modules`. Run `pnpm install` first.

## Out of scope

- Semantic search in rss-manager.
- Server-side query embedding for the website's MCP.
- "Related records" links on the website.
- An AI SDK adapter for `Embedder`.
- Renaming any existing environment variable.
