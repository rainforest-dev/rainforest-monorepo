# Shared Search 7: Website W1 and Private-Host Guards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The personal website adopts `tieredMatch`, `planReuse`, `ollamaChat`/`assertModel` and `createAiController`, and gains a lint guard and a build-output guard against reaching a private host.

**Parent plan:** `docs/superpowers/plans/2026-10-12-shared-search-library.md`, Task 7. Its Global Constraints apply.

**Projects:** `personal-website`, `personal-data` (owns `searchByTechnology`, which backs MCP `search_by_technology`).

## Steps

### 1. Lexical matching

- [ ] Add `"@rainforest-dev/search": "workspace:*"` to `apps/personal-website/package.json` and `libs/personal-data/package.json`; `pnpm install`; `pnpm nx sync`.
- [ ] `src/utils/search.ts`: `scoreMatch(query, title, keywords, expanded)` returns `tieredMatch(query, { title, keywords, expanded })`. Signature unchanged.
- [ ] `libs/personal-data/src/profile-data.ts`: `searchByTechnology` compares `fold(t).includes(fold(query))`. Add a full-width case to `profile-data.test.ts`.
- [ ] Verify: `pnpm nx test personal-website` (search, expansions and freshness tests unmodified), `pnpm nx test personal-data`.

### 2. Expansion reuse and the expansion script

- [ ] `src/utils/search-expansions.ts`: `planExpansion` builds `previous` from `existing` (`{ id, hash }`) and `current` from `records` (`{ id, hash: hashRecord(r) }`), then reads `planReuse`'s `reuse` and `missing`. Return shape unchanged.
- [ ] `scripts/expand-search-keywords.ts`: replace `assertReachable` with `assertModel(OLLAMA_URL, OLLAMA_MODEL)` from `@rainforest-dev/search/node`, mapping `OllamaSetupError.reason` to today's three messages. Replace the inline `/api/chat` fetch with `ollamaChat`, keeping the prompt, format and env names; map `OllamaHttpError` to today's HTTP message.
- [ ] Verify: `search-expansions.json` untouched (`git diff --stat`); `pnpm nx test personal-website`; `pnpm nx typecheck personal-website`.

### 3. Language model on the controller

- [ ] `src/utils/ai/use-language-model.ts`: one module-level `createAiController()`. The composable mirrors `getState()` into a `ref` through `subscribe`, `retain()`s on setup and releases plus unsubscribes on unmount. `enable` and `selectTool` keep today's contract: errors land in `error`, `selectTool` returns `null` on failure.
- [ ] Verify: `CommandPalette.test.ts` passes; Playwright headless ⌘K check against `pnpm nx dev personal-website`.

### 4. Lint guard

- [ ] `apps/personal-website/eslint.config.js`: for `src/**`, `no-restricted-imports` with the root `../*` pattern repeated plus `paths: [{ name: '@rainforest-dev/search/node', … }]`.
- [ ] Verify: temporarily import `@rainforest-dev/search/node` in a `src` file, `pnpm nx lint personal-website` fails; remove; lint passes. Paste the output in the PR.

### 5. Build-output guard

- [ ] `scripts/output-scan.ts`: `scanOutput(dir)` walks text files (`.js .mjs .cjs .html .json .css .txt .xml .webmanifest`), and returns `{ file, pattern, excerpt }[]` for `:11434`, `/api/embed`, `/api/chat`, `.ts.net`, `.local` hostnames and RFC 1918 addresses.
- [ ] `scripts/build-output.test.ts`: a fixture directory with `http://localhost:11434` fails the scan; a clean fixture passes; the real `dist` and `.vercel/output` pass.
- [ ] `vitest.config.ts` excludes `build-output.test.ts`; `vitest.output.config.ts` runs only it. Nx target `check-output` (`dependsOn: ["build"]`). CI adds `check-output` to the affected targets.
- [ ] Verify: `pnpm nx check-output personal-website`.

### 6. Finish

- [ ] `pnpm format:check`; `pnpm nx run-many -t lint test typecheck build -p personal-website personal-data`.
