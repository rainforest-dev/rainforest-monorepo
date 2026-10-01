# Memories content search

Date: 2026-10-01. Status: design approved by the owner section by section in conversation; this
file is the written spec for review. Builds on the natural-language date parser (PR #427) and the
people identity work (PR #439); both must be on `main` before implementation starts.

## Problem

The 「跳至日期」 box (`/`) finds days by date only. The owner wants to find a day by what happened
in it: 「吃麵那天」 should find the day a message says 「拉麵好好吃」 and the day a photo shows a bowl
of ramen. Messages, day notes and photos should all be searchable, across languages, and a future
Chrome Prompt API layer should be able to plug in without a rewrite.

## Decisions

1. **Semantic search with a lexical floor.** Every query runs a lexical match; a semantic match
   runs alongside it when the embedding service answers. Results are merged by rank.
2. **Photos are searched through text.** Each photo becomes a text document built from the
   Photos metadata that osxphotos exports: scene labels, OCR text, venues, place, people and
   albums. Pixel embeddings (CLIP-style) are deferred; see Out of scope.
3. **Results are days.** They appear as a 「內容」 group under the date results in the existing
   jump box, each day with its best snippet, and a final 「看全部結果」 row. A full results page is
   deferred.
4. **No separate index service.** The corpus is in the order of 10⁴ events and under 10⁴ search
   documents, so vectors fit in memory (tens of MB as `Float32Array`) and brute-force cosine
   takes milliseconds. The index is a pair of files written by `ingest` and loaded into the
   existing Astro server. Revisit only if one vector space passes about 10⁵ entries, a second
   process must write the index, or the data can no longer be reloaded whole.
5. **Embeddings come from Ollama.** `embeddinggemma` (768 dimensions, multilingual) on an Ollama
   endpoint configured by `MEMORIES_OLLAMA_URL`. The Node container loads no model. Apple's scene
   labels are English, so cross-language matching (「拉麵」 to `Ramen`) depends on this model.
6. **Shared code where there are two consumers.** The Prompt API wrapper in
   `apps/personal-website/src/utils/ai/` moves, minus its Vue composables, to a new framework-free
   `libs/web-ai`; the website keeps its composables on top of it and memories adds a React hook.
   Search code stays in `apps/personal-memories/src/lib/search/`, written against its own types
   so it can move to a library when a second consumer appears.
7. **Latest Prompt API.** Target the API shipped on the web in Chrome 148 and
   `@types/dom-chromium-ai` 0.0.17: `measureContextUsage`, `contextUsage` and `contextWindow`
   replace the removed `measureInputUsage`, `inputUsage` and `inputQuota`; the web exposes no
   `temperature` or `topK`. Supported languages are en, ja, es, de and fr, so Chinese queries
   cannot use it yet.
8. **Code is shared, indexes never are.** The public website gets no semantic index (a separate
   loop task covers offline keyword expansion for its palette); memories data never leaves the
   memories server.

## Architecture

```
libs/web-ai                      framework-free
  capability.ts   availability() probe with expected languages, timeout, cached verdict
  session.ts      one session per page, create/destroy, download progress
  structured.ts   prompt() with responseConstraint
    ▲ Vue composables (personal-website)      ▲ React hook (personal-memories)

apps/personal-memories/src
  lib/natural-date.ts, lunar.ts        PR #427
  lib/people.ts, server/people-store   PR #439
  lib/search/
    query.ts      SearchQuery, SearchQuerySchema (zod), localParser
    lexical.ts    substring match with person and place facet boosts
    vector.ts     cosine top-k over a Float32Array
    rrf.ts        reciprocal rank fusion
    embed.ts      Ollama /api/embed client: timeout, circuit breaker, prefixes
  lib/search-docs.ts   timeline events, notes and photos → SearchDoc[]
  lib/server/search-index.ts   load docs + vectors, reload on mtime, search()
  cli/ingest.ts        also writes search/docs.json and search/vectors.text.bin
  pages/search.json.ts
  components/chrome/DateJump.tsx   「內容」 group and 「看全部結果」
```

## Data

### SearchDoc

```ts
type SearchDoc = {
  id: string; // stable: source + first event id
  day: string; // YYYY-MM-DD, Asia/Taipei
  kind: 'chat' | 'photo' | 'note';
  text: string; // what is embedded and matched
  snippet: string; // shown in results
  people: string[]; // person ids from people.json
  places: string[];
  eventIds: string[];
  contentHash: string;
};
```

The server builds `SearchDoc[]` from the timeline at load time; the builder is a pure function.
The timeline stays the single source of truth and the vector file is a cache keyed by
`contentHash`.

- **Chat.** Per source, in time order, a message joins the current chunk when it comes within 10
  minutes of the previous one. A chunk closes at 40 messages or 1,500 characters. Each line is
  `HH:MM <display name>：<text>`, with display names resolved through people so one person reads
  the same on every platform. Events carry no chat id today, so two chats active in the same
  minutes can share a chunk; the plan checks whether ingest can add one.
- **Photo.** One document per photo:
  `labels: …｜文字: <OCR>｜場所: <venues>｜地點: <place>｜人物: <people>｜相簿: <albums>`.
  People, place and albums also go into the facets.
- **Note.** One document per day note (body and 眉批). Notes are not written by ingest: the data
  directory is mounted read-only and the notes directory is writable, so the server embeds notes
  in the background at startup and again for one note when it is saved, cached in memory by
  `contentHash`.

### Files written by ingest

`<MEMORIES_DATA_DIR>/search/docs.json`:

```json
{
  "model": "embeddinggemma",
  "dims": 768,
  "docs": [{ "id": "…", "contentHash": "…" }]
}
```

`<MEMORIES_DATA_DIR>/search/vectors.text.bin`: `docs.length × dims` little-endian float32, in
`docs` order. Ingest reuses the stored vector for every doc whose `contentHash` is unchanged and
embeds only new or changed docs, in batches. A future image space adds `vectors.image.bin`
alongside it without changing this format.

### Photos metadata

The `photos/index.json` export must come from osxphotos 0.77.2 or later. Earlier versions read the
Photos search index from `database/search/psi.sqlite`, which current Photos replaced with
`leo.sqlite`, and silently export empty `search_info`. The README pins
`uvx osxphotos@0.77.2`, and ingest warns when no photo has labels.

### Embedding prompts

EmbeddingGemma expects task prefixes, documented as `task: search result | query: …` for queries
and `title: none | text: …` for documents. The plan verifies them against the model card before
`embed.ts` hard-codes them.

## Query flow

```
browser   raw query → QueryParser → SearchQuery { text, range?, people?, sources? }
          GET /search.json?q=&from=&to=&people=&sources=
server    validate with zod
          docs ← filter by range, people, sources
          lexical rank  ← substring on text, boosted by person and place facets
          semantic rank ← embed(text) → cosine over vectors (skipped when unavailable)
          merge with RRF: score(d) = Σ 1 / (60 + rank_i(d))
          group by day: a day's score is its best doc's; snippet from that doc
          → { results: [{ kind: 'content', date, score, snippet, source }], semantic, reason?, stale? }
client    「內容」 group under the date group; 「看全部結果」 last
```

RRF uses ranks only, so cosine similarity and lexical scores never need a common scale, and an
image space later adds one more ranking.

## Query parsing and the Prompt API

```ts
type SearchQuery = {
  text: string;
  range?: { start: string; end: string };
  people?: string[];
  sources?: TimelineSource[];
};

interface QueryParser {
  parse(raw: string, today: string): Promise<SearchQuery>;
}
```

- `localParser` takes the date with `parseDateQuery`, people by matching display names and
  aliases from the public people list (「Bob 說的拉麵」 → `people: ['bob']`, `text: '拉麵'`), and
  leaves the rest as `text`.
- `promptParser` calls `prompt()` through `libs/web-ai` with
  `responseConstraint: z.toJSONSchema(SearchQuerySchema)`, validates the output with the same
  schema, and falls back to `localParser` on invalid output or after 1.5 s.
- `promptParser` is chosen only when
  `availability({ expectedInputs: [{ type: 'text', languages: ['zh'] }] })` is `available`.
  Today that is never true, so no control to enable it is shown. The model download needs a user
  gesture and is never started in the background.

## Failure handling

Any failure degrades to lexical search and says so: the response carries `semantic: 'off'` and a
`reason`, and the jump box shows one line, 「語意搜尋暫時無法使用，只顯示字面相符的結果」.

| Situation                                                 | Behaviour                                                  | `reason`             |
| --------------------------------------------------------- | ---------------------------------------------------------- | -------------------- |
| Ollama unreachable                                        | lexical only                                               | `ollama-unreachable` |
| Query embedding over 800 ms                               | lexical only; skip semantic for 30 s                       | `timeout`            |
| `docs.json` model or dims differ from the query embedding | lexical only                                               | `model-mismatch`     |
| No vector file                                            | lexical only                                               | `no-index`           |
| Some docs changed since ingest                            | those docs are lexical only                                | none; `stale: n`     |
| Note embedding fails in the background                    | that note is lexical only until its next save or a restart | none                 |

The vector file is reloaded when its mtime changes, so running ingest needs no restart. The
client debounces input by 250 ms, aborts the previous request through TanStack Query's `signal`,
starts after one CJK character or two Latin letters, and receives at most 20 days.

## Testing

- **Unit (Vitest).** Lexical matching, facet boosts, cosine top-k and tie order, RRF (one list,
  both lists, empty), `localParser`, chunking limits, photo document text, stable
  `contentHash`; `embed.ts` with an injected `fetch` for timeout, unreachable, wrong dimensions
  and the circuit breaker; the `/search.json` handler as a pure function for each `reason`;
  `libs/web-ai` keeps the website's tests and adds the language-aware probe, which must report
  `unsupported` where `LanguageModel` is undefined.
- **Deterministic embeddings for e2e.** `MEMORIES_EMBED=fake` swaps in an embedder that maps text
  onto a few fixed concept dimensions (麵, ramen and noodle share one), so cross-language hits are
  reproducible without Ollama.
- **E2E (Playwright, fixture).** The fixture gains a day whose messages mention 拉麵 and a photo
  labelled `Ramen`. 「拉麵」 shows the right day and snippet and Enter jumps there; 「去年中秋」 still
  resolves through the date group; with the embedder forced to fail, lexical results and the
  degradation line still show; 「Bob」 returns his LINE and Slack days.
- **Privacy guard.** Every task ends with the privacy grep kept in the owner's task notes (real
  names and personal addresses, listed only in the private vault) over `apps/personal-memories`
  and `apps/personal-memories-e2e`, and it must return nothing. The repository is public; only
  fixture names appear in code, tests and PR evidence.

## Out of scope

- Pixel embeddings for photos (`vectors.image.bin`). A spike on public COCO images measured about
  10 ms per image for the encoder on Apple Silicon (MPS) with Chinese-CLIP B/16 and SigLIP 2 B/16
  and usable Chinese queries; decide after this ships, by comparing real queries with and
  without it.
- A full search results page.
- Prompt API parsing in production use, until Chrome supports Chinese.
- Website keyword expansion (separate loop task) and any website semantic index.
