# Shared Search Task 8: Website Offline Semantic Neighbours

> **For agentic workers:** step-level plan for Task 8 of `2026-10-12-shared-search-library.md`. Its Global Constraints apply unchanged.

**Goal:** Generate `src/data/search-neighbours.json` offline with Ollama EmbeddingGemma 2 and fuse its vocabulary neighbours into the ⌘K palette with `rrf`.

**Architecture:** A build module in `scripts/` owns everything that needs hashing or Ollama: the vocabulary, the per-record document text and hashes, the vector cache and the top-k selection. The runtime module in `src/utils/` owns only the lookup and the fusion, imports nothing from `node:` and nothing from `@rainforest-dev/search/node`.

## Decisions

- Document text per record: `title`, then keywords, then expansion terms, joined with `. `. The record hash is sha256/16 of that text, so a changed expansion also marks the record stale.
- Vocabulary: folded words of every title (split as `normalizeTerms` splits), every keyword and every expansion term, deduplicated, sorted, at least two characters. Its hash is sha256/16 of the JSON array.
- Records are embedded as `document`, terms as `query`, so EmbeddingGemma's prefixes match their roles.
- Neighbours are kept per term **per language** (top 8 for `en`, top 8 for `zh`, from the id's second segment). The palette shows one language at a time, so a global top 8 would leave one language with nothing for many terms.
- Scores are rounded to three decimals. Terms with no neighbour above the floor are dropped.
- Cache: `.cache/search-vectors/` (gitignored), two index pairs written with `writeIndexFiles`: `records.json`/`records.bin` and `terms.json`/`terms.bin`. Rows are reused through `planReuse` only when model and dims match.
- Run time: `neighbourRanking(query, file)` folds and trims the query; below two characters it returns `[]` without reading `terms`. Otherwise every term equal to or starting with the query contributes its neighbours, a record keeps its best score, and the ranking is score desc then id asc. `searchRecords` keeps today's order when that ranking holds none of its records, and otherwise orders the union by `rrf([tiered, neighbours])`, ties in tiered order.

## Floor calibration

A 30-query set, 20 vocabulary terms plus 10 queries outside the vocabulary (the W2 spike reuses it), lives in `scripts/search-eval-queries.ts`. Each of the 20 in-vocabulary terms has hand-labelled relevant records. The floor is the lowest cosine among those labelled neighbours, written as `NEIGHBOUR_FLOOR` and into the PR with the per-term table.

## Steps

- [ ] 1. `.gitignore` `.cache/`; add `build-search-neighbours` Nx target (`node scripts/build-search-neighbours.ts`, `dependsOn: ["^build"]`).
- [ ] 2. `scripts/search-neighbours-build.ts`: `documentText`, `hashText`, `buildVocabulary`, `selectNeighbours`, `serializeNeighbours`, `NEIGHBOUR_FLOOR`; unit tests.
- [ ] 3. `scripts/build-search-neighbours.ts`: `assertModel` (non-zero exit with its message), embed missing rows with `ollamaEmbedder`, write cache and JSON.
- [ ] 4. `src/utils/search-neighbours.ts`: `NeighbourFile`, `neighbourRanking`, `fuseRankings`; `searchRecords` takes the neighbours file as an optional third argument defaulting to the committed artifact.
- [ ] 5. Run the script against local Ollama, calibrate the floor, regenerate.
- [ ] 6. `scripts/search-neighbours-freshness.test.ts`: fails on a changed record or vocabulary, prints the regenerate command.
- [ ] 7. Tests on the committed artifact: "資料庫" finds a record that neither lists it nor has it in expansions; a one-character query equals `tieredMatch` plus expansions alone; file under 100 KB.
- [ ] 8. `pnpm nx run-many -t lint test typecheck build check-output -p personal-website`, `pnpm format:check`.

## Acceptance (from Task 8)

1. Ollama unreachable → script exits non-zero with the `assertModel` message (manual: `OLLAMA_URL=http://127.0.0.1:9`).
2. Freshness test fails after a keyword change, passes after regeneration (Vitest; shown once in the PR).
3. "資料庫" neighbour hit (Vitest on the artifact).
4. One-character query does no lookup (Vitest).
5. Artifact < 100 KB; Task 7 guards, lint, test, typecheck, build pass.
