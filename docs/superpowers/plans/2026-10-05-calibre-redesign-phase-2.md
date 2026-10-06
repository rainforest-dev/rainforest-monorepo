# personal-calibre redesign, phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the third view, 書房 Study: one shared model and DOM accessibility layer, the `css`
renderer, and the `three-tsl` renderer (`WebGPURenderer` + TSL, falling back to its own WebGL2
backend) as the default, with a `Renderer` select, the `?renderer=` / cookie override, a `?debug`
backend badge, a CSS fallback when 3D cannot start, and three.js loaded only while Study shows.

**Architecture:** Pure code in `src/lib/study/` turns the server page (`LibraryEntry[]`) into a
`StudyModel` (shelves) and a `StudyLayout` (placed books, boards, rows, labels), plus the helpers
the renderers share: spine dimensions and tone, the CJK test, atlas order, camera bounds, the
focus-rect projection and renderer selection. `src/components/views/study/StudyView.tsx` owns the
DOM layer: one `role="listbox"` named `Bookshelves`, a `role="group"` per shelf and a
`role="option"` per book, driven by the existing `useRovingNav` fed with layout rows. The `css`
renderer makes those options the visible spines. The `three-tsl` renderer renders them `sr-only`
over an `aria-hidden` canvas and reads focus, selection and the open book from the same provider
state. `ThreeStudy` is a `next/dynamic` (`ssr: false`) chunk, and inside it the renderer kit
(`kitTsl`) is a second dynamic import, the seam phase 3 uses for `kitGlsl`.

**Tech Stack:** Next.js 16.2.11 App Router with `cacheComponents: true`, React 19.2.3 (catalog),
`@rainforest-dev/rainforest-react`, `@rainforest-dev/rainforest-ui/interaction` (`pickTarget`,
`NavItem`), zod 4 (`^4.6.5`, the app's pin), Vitest 4.1.4, Playwright with `@axe-core/playwright`.
New in this phase, pinned exactly as in the spike: `three` 0.186.1, `@react-three/fiber` 9.8.1,
`@types/three` 0.186.0 (dev). fiber 9.8.1 needs `react >=19 <19.4`; the catalog resolves 19.2.3.
No `@react-three/drei`.

**Spec:** `docs/superpowers/specs/2026-09-29-calibre-redesign-design.md`, Study section and the
phase 2 rows of every table. Phase 1 landed on `main` (plan
`docs/superpowers/plans/2026-09-29-calibre-redesign-phase-1.md`); since then the app moved
server-only code to `src/lib/server/`, adopted barrels, and moved roving navigation and shortcuts
to `@rainforest-dev/rainforest-ui/interaction`. This plan is written against `main` at `0a8f99af`.

**Spike:** local branch `spike/calibre-3d`, commit `864cc473`, route `/spike/study`. Read it with
`git show spike/calibre-3d:<path>`; never merge or check it out. What carries over is listed in
[What to take from the spike](#what-to-take-from-the-spike-and-what-to-rewrite).

## Plan decisions (where the spec is silent or cannot be followed literally)

- D1 Pure Study code lives in `src/lib/study/` (barrel `src/lib/study/index.ts`, re-exported from
  `src/lib/index.ts`), not in `views/study/model.ts` as the surface mapping sketches. CLAUDE.md
  `### Imports` forbids a module importing its own or an ancestor directory's barrel, and the
  renderers sit in `views/study/css/` and `views/study/three/`, below the model. In `src/lib` the
  code is environment-neutral, Vitest's node environment runs it, and it never imports `three`
  (one type-only import from `@rainforest-dev/rainforest-ui/interaction` is allowed).
- D2 Preview seam for renderers. `ENABLED_RENDERERS` (offered by the select, honoured from the
  cookie) and `PREVIEW_RENDERERS` (honoured only from `?renderer=`). Until Task 13,
  `ENABLED_RENDERERS = ['css']` and `PREVIEW_RENDERERS = ['three-tsl']`, so Tasks 6-12 can land on
  `main` one by one while users keep the CSS study. Task 13 sets
  `ENABLED_RENDERERS = ['three-tsl', 'css']` and `PREVIEW_RENDERERS = []`, which makes P20's
  default real. `three-glsl` is in neither list in phase 2, so a cookie or param asking for it
  resolves as if it were absent.
- D3 `pickRenderer` order (P20 plus D2): the session fallback wins (`css`); then `?renderer=` if it
  is enabled or preview; then the cookie if it is enabled; then `ENABLED_RENDERERS[0]`.
- D4 "Switches to `css` for the session" (P20) is a provider flag mirrored to `sessionStorage`
  (`calibre-study-fallback=1`), per tab. A reload in the same tab does not retry the renderer that
  just failed or toast again; a new tab tries again. The cookie is never written by a fallback.
  Owner decision (PR #484): tab-scoped, as planned.
- D5 The `ThreeStudy` error boundary's `Use CSS study` button takes the same path as the automatic
  fallback (session flag, no cookie write). Owner decision (PR #484): both persist in
  `sessionStorage` only, never in the cookie.
- D6 `spineDims(id)` returns prototype pixels: `width = 26 + (id * 7) % 16`,
  `height = 172 + (id * 13) % 38`, `depth = round(height * 0.66)` (`V2Spine` in `v2-views.jsx` and
  the spike's `dimsOf`, which is the same formula over 100). The three.js layout divides by
  `MODEL_PX_PER_UNIT = 100`. The css renderer scales by `k` (1, or 0.82 on phone).
- D7 Spine tone is `chart-(id % 5 + 1)` (P15 and the existing `spineClass`), not the spike's
  `((id - 1) % 5) + 1`. The side colour is that chart colour 45% into `muted`, matching
  `spineClass`; the atlas stripes use the prototype's `v2Stripe(tone, 24, 36)` mixes and the
  `55%` band.
- D8 Study navigation is fed from the layout, not from DOM rects. `useRovingNav` gains two
  options: `items?: () => readonly NavItem[]` (when present it replaces `collectItems`) and
  `scrollOnFocus?: boolean` (default `true`). `three-*` passes
  `{ key, row: placed.row, order, col: placed.x }` items (no rect, so `pickTarget` measures
  vertical distance by `col`) and `scrollOnFocus: false`, because the camera follows focus and an
  `sr-only` option has nothing to scroll to. `css` keeps DOM rects with `data-nav-row` set to the
  shelf key, so a bay is a row (P10). Owner decision (PR #484): in the css renderer `↓` moves to
  the next shelf in reading (DOM) order, even when the bay grid places it to the right.
- D9 P8 on first load is a server redirect. `page.tsx` resolves the view
  (`resolveView(prefs.view, raw.view)`); when it is `study` and `groupBy` is not `series` or
  `author`, it redirects to `buildLibraryHref(raw, { groupBy: 'series' })`, which drops `page`.
  A view switch to Study does the same on the client through `replaceParams`, with
  `requestFocus({ kind: 'book', id: focusId, orFirst: true })`.
- D10 `PendingFocus` gains an optional `orFirst: true` on the `book` kind: when the book is not
  on the new page, focus goes to the first option instead of waiting forever (P8's "else the first
  book").
- D11 The Study `Group` select offers `Series` and `Author` only (P8). Leaving Study keeps
  whatever Study set.
- D12 Backend values: `data-backend` is `webgpu`, `webgl2` or `css`; `data-renderer` is the
  resolved renderer. Labels per P23 and Copy: `three-tsl · WebGPU`,
  `three-tsl · WebGL2 fallback`, `css`.
- D13 Before downloading three.js, `canUseWebGL2()` (a throwaway canvas, `getContext('webgl2')`,
  then `WEBGL_lose_context`) and `'gpu' in navigator` are checked. With neither, Study goes
  straight to the CSS fallback without fetching the chunk.
- D14 Debug probe: only with `?debug` in the URL, `ThreeStudy` publishes
  `window.__calibreStudy: StudyProbe` (timings, `pulledId`, `info()`) for the perf script.
  Without `?debug` nothing is put on `window`. Tests that do not measure use the always-present
  `data-renderer`, `data-backend` and `data-pulled-id` attributes instead.
- D15 Program count ("does not grow during a sweep", TSL requirement 2). The spike never measured
  it. Task 7 step 1 reads `node_modules/three/src/renderers/common/Info.js` and
  `Pipelines.js` at 0.186.1 and records which counter `StudyProbe.info().programs` reports
  (the render-pipeline cache size on `WebGPURenderer`, `info.programs.length` on
  `WebGLRenderer`). If three exposes no counter, the probe counts distinct
  `material.customProgramCacheKey()`-equivalent node cache keys seen by `onBeforeRender`, and the
  PR says so.
- D16 Fixture covers. The spec wants the real cover on the Study cover face and a cover prewarm,
  and today's fixture has `has_cover = 0` everywhere (phase 1 D21). Task 3 writes made-up covers
  (flat chart-like colour blocks, no text, generated with `node:zlib` as PNG bytes) to
  `cover.jpg` for books whose `id % 10 === 7`, and sets `has_cover = 1` for them. Browsers sniff
  image bytes, so `<img>` and `createImageBitmap` decode them despite the `image/jpeg` header the
  route sends.
- D17 Headless WebGL. Headless Chromium no longer falls back to SwiftShader for WebGL on its own.
  The `chromium` project gets `launchOptions.args: ['--enable-unsafe-swiftshader']` (the spike's
  `common.mjs` used it), so the forced WebGL2 run works headless.
- D18 Visual parity is computed inside the spec, in the browser, from two screenshots
  (`createImageBitmap` → `OffscreenCanvas` → `getImageData`): per-channel tolerance 12/255 (the
  spike's `diff3.mjs`), at most 0.3% of pixels over tolerance, and "edges only" means every
  mismatched pixel lies within 2 px of a reference pixel whose 3×3 luminance range exceeds 24.
  No `sharp` or `pixelmatch` dependency.
- D19 Bundle check. Next 16 builds with Turbopack, whose react-loadable manifest may not list the
  dynamic chunks. Task 12 step 1 checks `.next/react-loadable-manifest.json` after a build. The
  gating check is a runtime scan that does not depend on the manifest: on `next start`, collect
  every script a route loads and fail if any contains `isWebGLRenderer` (three core) or
  `isWebGPURenderer` (`three/webgpu`). Those property names survive minification.
- D20 Phone (below `lg`): the canvas wrapper is `h-[min(70dvh,640px)]`, `pxPerUnit` 80 instead of
  100 (the spike's values). The css renderer shows one bay per row at 0.82 scale (spec).
- D21 The atlas and cover caches key on `contentKey(entries)` and the layout width (P14), so an
  RSC refresh with equal data rebuilds nothing; a page change disposes every row atlas.
- D22 One toast per session for the fallback (`3D isn't available here, showing the CSS study`),
  guarded by the same `sessionStorage` flag as D4.
- D24 Next-page cover ids come from the server (owner decision, PR #484). `LibraryResult` gains
  `nextPageCoverIds: number[]`: the distinct ids of the books on page `page + 1` that have a
  cover, in that page's order, in the same grouping and sort; `[]` on the last page. Task 10 adds
  it to `queryLibrary` in `src/lib/server/library-query.ts`, so `getLibrary` (`'use cache'`, tag
  `books`) carries it with no new cache key. `BookSummary`, `getBookList`, `getGroupedBookList`,
  the MCP tools and OPDS are untouched.
- D25 Atlas resolution under the texture budget (owner decision, PR #484): the budget stays
  (≤ 50 MB reported on desktop @2x, ≤ 30 MB on phone) and atlas resolution gives way. The
  pixels per unit come from a fixed ladder `[160, 128, 112, 96]`; `pickAtlasPpu` (Task 9) picks
  the highest rung whose estimated atlas bytes fit what the budget leaves after the cover cache
  and the renderer's colour targets. Task 13 verifies the reported number on the large fixture
  and tunes the estimate's constants, never the budget.
- D23 Console allowlist for three.js runs: `THREE.Clock` deprecation (spec, accepted). Any other
  warning or error fails the spec. `shadows={false}` on the Canvas removes the
  `PCFSoftShadowMap` warning.

## Global Constraints

- Work only in the worktree the controller names, on a branch cut from `origin/main`. Never `cd`
  to the repository root. Never `git stash`.
- Every task runs through `pnpm nx`:
  - Unit: `pnpm nx test personal-calibre -- src/lib/study/<file>.test.ts`
  - Types: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
  - Lint: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
  - E2E: `pnpm nx e2e personal-calibre-e2e -- --grep "<title>"`, with `--project=<name>` where a
    task says so
  - Never call npm scripts, `vitest`, `playwright` or `next` directly.
- E2E servers: before and after every e2e run,
  `pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids`. `next dev` rewrites
  `apps/personal-calibre/next-env.d.ts`; restore it with
  `git checkout -- apps/personal-calibre/next-env.d.ts` before every commit.
- Dev differs from build. A task that changes a route file, a layout, `page.tsx` or anything
  `next/dynamic` loads ends by loading the pages it names from a running dev server on the fixture
  (phase 1 Global Constraints, port 3335) with no console error and no Next.js overlay.
- `cacheComponents` is on: request data is read inside Suspense, `'use cache'` functions never
  read request data, no `export const dynamic`.
- Imports follow CLAUDE.md `### Imports`:
  - `@/` alias across directories, through the target directory's barrel; `./file` inside a
    directory; never `../` (lint fails on it).
  - Never import your own directory's barrel or an ancestor's: `views/study/three/*` imports
    `@/components/views/study/StudyListbox` by file, not `@/components/views/study`.
  - `src/lib/study/` is pure and environment-neutral; it never imports `three`, React or
    `next/*`. Server-only code stays in `src/lib/server/` behind its own barrel.
  - `views/study/three/` has no barrel. `ThreeStudy` and the kits are reached only through
    `import('./three/ThreeStudy')` and `import('./kitTsl')`, so no barrel can pull three.js into a
    first-load chunk. `views/study/index.ts` exports `StudyView` only.
  - `import-x/no-cycle` must stay green; type-only imports do not count.
- Docker image: built from prebuilt artifacts (`nx bundle`, `tools/app-artifact/`, #468). Every
  task that adds a dependency or a route ends with `pnpm nx smoke-artifact personal-calibre`.
  three.js and fiber are client-only, so they must appear in `.next/static` chunks and nowhere in
  the traced server output; Task 6 checks both.
- MCP and gateway code stays untouched (#475): `src/app/mcp/`, `src/app/api/mcp/`,
  `src/lib/server/mcp/`, `libs/mcp-kit/`. Last step of every task:
  `git diff --stat origin/main -- apps/personal-calibre/src/app/mcp apps/personal-calibre/src/app/api/mcp apps/personal-calibre/src/lib/server/mcp libs/mcp-kit`
  prints nothing, and `mcp.spec.ts` still passes in the task's e2e run.
- Semantic tokens only: no hex, no raw palette classes, no `dark:`. three.js reads token colours
  from computed styles (`readTokens`), never from literals.
- Fixture data only: the seeded made-up library (`apps/personal-calibre-e2e/src/support/seed.ts`)
  and the covers Task 3 generates. No real books, authors or covers in tests, captures or PRs.
- Comment allow-list, every language and every code sketch in this plan: one line naming an
  external constraint the code works around, the reason on a lint suppression, `TODO(<ticket>)`.
  Nothing else. Last step of every task:
  `git diff -U0 origin/main | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'` and justify each hit.
  The external-constraint lines this plan expects are named where they occur (React's passive
  `onWheel`, `TextureNode` ignoring offset/repeat, `ImageBitmap` orientation).
- Copy is verbatim from the spec's Copy section (Study, phase 2).
- Commits: conventional, scope `personal-calibre` (or `personal-calibre-e2e` for an e2e-only
  change), path-scoped `git add` of the task's files only, never `--no-verify`, no signing flags,
  and every message ends with these two lines after a blank line:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QYp97ZYgjC8sGokaNAwxxz
  ```

- No `Refs:` trailer (personal repo).

## Review Focus

1. One focus path. Keyboard focus, pointer picks on the canvas and `Enter` all go through the DOM
   option; `data-pulled-id` always equals the focused option's `data-book-id` after a key press
   (Task 8 step 1, Task 12 step 2).
2. The fallback never writes the cookie and never loops: no WebGPU and no WebGL2, or a throw
   during start, lands on `css` once, with one toast, and a reload in the same tab stays on `css`
   (Task 6 step 1, Task 12 step 3).
3. Nothing from three.js in any first load, including `/` with `view=study` in the cookie while
   the renderer resolves to `css` (Task 6 step 5, Task 12 step 4).
4. Programs do not grow during a sweep: selection, highlight, pulled-book changes and atlas
   arrival only set uniform and texture `.value`s (Task 7, Task 13 step 2).
5. P8 round trip: entering Study with no Group or Tag lands on `groupBy=series` page 1 with focus
   on the same book when it is there, else the first book; Back after that does not bounce
   (Task 4 step 1).

## Execution order and pull requests

| Task | Title                                                | Depends on | Pull request              |
| ---- | ---------------------------------------------------- | ---------- | ------------------------- |
| 1    | Study model and layout                               | -          | PR A (own)                |
| 2    | Renderer resolution, preview seam, debug flag        | -          | PR B (own)                |
| 3    | E2E support: covers, Study helpers, browser projects | -          | PR C (own)                |
| 4    | Study view, DOM layer, P8                            | 1, 2, 3    | PR D (with Task 5)        |
| 5    | `css` renderer; Study in the switcher                | 4          | PR D                      |
| 6    | three.js loading, TSL renderer, fallback, select     | 5          | PR E (own, preview only)  |
| 7    | TSL materials (`studyMaterial.ts`)                   | 6          | PR F (own, preview only)  |
| 8    | Shared scene: rows, pulled book, camera, pointer     | 7          | PR G (own, preview only)  |
| 9    | Per-shelf atlas                                      | 8          | PR H (own, preview only)  |
| 10   | Next-page cover ids from `getLibrary`                | 3          | PR L (own)                |
| 11   | Focus overlay, shelf headings, covers and prewarm    | 9, 10      | PR I (own, preview only)  |
| 12   | E2E matrix, axe, parity, bundle check                | 11         | PR J (own)                |
| 13   | Perf sweep, budgets, default flip, captures          | 12         | PR K (own; ships default) |

Tasks 1, 2 and 3 are independent and may run in parallel (different files). Task 10 is a
server-only change that needs only Task 3 (its e2e uses the fixture covers) and can land any time before Task 11. From Task 4
on the Study tasks run one at a time. Tasks 4 and 5 form one PR because Task 5 is what turns Study on in the switcher;
Task 4 alone has no reachable UI. Every Study PR from E to J is safe on `main` because `three-tsl` is
reachable only through `?renderer=three-tsl` (D2). PR K flips the default, so it carries the
budgets, the parity numbers and the captures.

## File map

Paths under `src/` are relative to `apps/personal-calibre/`; e2e paths are under
`apps/personal-calibre-e2e/`.

```
apps/personal-calibre/
  package.json                          three, @react-three/fiber, @types/three   (T6)
  src/types/calibre.ts                  LibraryResult.nextPageCoverIds           (T10)
  src/lib/server/library-query.ts       nextPageCoverIds in queryLibrary         (T10)
  src/lib/server/library-query.test.ts                                           (T10)
  src/test/calibre-db.ts                TestBook.hasCover                        (T10)
  src/lib/study/index.ts                barrel                                   (T1)
  src/lib/study/model.ts                buildStudyModel, spineDims, spineTone,
                                        isCjk, isStudyGroupBy                    (T1)
  src/lib/study/layout.ts               layoutShelves, studyNavItems, constants  (T1)
  src/lib/study/renderer.ts             pickRenderer, labels, enabled/preview    (T2)
  src/lib/study/scene-math.ts           atlasOrder, cameraBounds, clampCameraY,
                                        projectBox, pickAtlasPpu                 (T8, T9, T11)
  src/lib/study/*.test.ts                                                        (T1, T2, T8-T11)
  src/lib/index.ts                      + export * from './study'                (T1)
  src/lib/prefs.ts                      resolveRenderer removed (moved, T2)      (T2)
  src/lib/library-params.ts             ParamPatch.renderer, isDebug             (T2)
  src/lib/keyboard.ts                   unchanged (Study hints exist)
  src/providers/LibraryProvider.tsx     renderer state, fallback, backend,
                                        PendingFocus.orFirst, P8 in setView      (T4, T6)
  src/hooks/useRovingNav.ts             items, scrollOnFocus options             (T4)
  src/hooks/useReducedMotion.ts                                                  (T5)
  src/components/library/ViewSwitch.tsx Study item                               (T5)
  src/components/library/ViewRegion.tsx StudyView branch; next-page cover ids   (T4, T11)
  src/components/library/ViewSkeleton.tsx Study skeleton                         (T4)
  src/components/library/SortControls.tsx GroupSelect: Series/Author in Study    (T4)
  src/components/library/LibraryToolbar.tsx RendererSelect, BackendBadge         (T6)
  src/components/library/RendererSelect.tsx, BackendBadge.tsx                    (T6)
  src/components/views/index.ts         + StudyView                              (T4)
  src/components/views/study/index.ts   export { StudyView }                     (T4)
  src/components/views/study/StudyView.tsx      model, renderer switch           (T4, T6)
  src/components/views/study/StudyListbox.tsx   DOM layer, shared                (T4)
  src/components/views/study/StudyOption.tsx    option attributes                (T4)
  src/components/views/study/StudySkeleton.tsx  three bays of 7 spines           (T4)
  src/components/views/study/css/CssStudy.tsx, Spine.tsx                         (T5)
  src/components/views/study/three/ThreeStudy.tsx   dynamic root, Canvas         (T6, T8)
  src/components/views/study/three/ThreeStudyBoundary.tsx                        (T6)
  src/components/views/study/three/loadThreeStudy.ts  next/dynamic wrapper       (T6)
  src/components/views/study/three/kit.ts       StudyKit contract (types)        (T6)
  src/components/views/study/three/kitTsl.ts    WebGPURenderer factory           (T6, T7)
  src/components/views/study/three/studyMaterial.ts  TSL, only shader source     (T7)
  src/components/views/study/three/Scene.tsx, ShelfRow.tsx, PulledBook.tsx       (T8)
  src/components/views/study/three/tokens.ts    readTokens, useTokens            (T8)
  src/components/views/study/three/atlas.ts     drawSpine, buildRowAtlas         (T9)
  src/components/views/study/three/useRowAtlases.ts                              (T9)
  src/components/views/study/three/covers.ts    LRU, drawCover, loadCover        (T11)
  src/components/views/study/three/FocusOverlay.tsx, ShelfLabels.tsx             (T11)
  src/components/views/study/three/probe.ts     ?debug probe                     (T6, T8)
  src/app/(library)/page.tsx            P8 redirect                              (T4)
  src/app/globals.css                   st-* css renderer classes                (T5)
apps/personal-calibre-e2e/
  playwright.config.ts                  swiftshader arg, study-webgpu, no-webgl  (T3)
  package.json                          perf-study target                        (T13)
  src/support/seed.ts                   covers for id % 10 === 7                 (T3)
  src/support/study.ts                  Study helpers                            (T3)
  src/study.spec.ts                     DOM layer, keyboard, P8, pages           (T4, T5, T12)
  src/study-three.spec.ts               pulled id, overlay, reduced motion, debug (T6, T8, T11, T12)
  src/pages.spec.ts                     next-page cover ids in the RSC payload   (T10)
  src/study.phone.spec.ts                                                        (T5, T12)
  src/study.no-webgl.spec.ts            fallback                                 (T6)
  src/study-parity.spec.ts              WebGPU vs WebGL2                         (T12)
  src/study-bundle.spec.ts              first-load scan (CALIBRE_BUDGETS=1)      (T6, T12)
  src/a11y.spec.ts                      Study pages                              (T5, T12)
  src/visual.spec.ts                    Study surfaces                           (T13)
  perf/study-sweep.mjs                  the spike's sweep, moved and reworked    (T13)
tools/app-artifact/smoke.mjs            /?view=study&groupBy=series check        (T5)
```

---

### Task 1: Study model and layout

Spec: Study › Shared model and DOM accessibility layer (`StudyModel`, `layoutShelves`,
`spineDims`, `isCjk`); P6, P8, P14, P15, P16; Testing › Phase 2 (`layoutShelves`, `spineDims`,
`isCjk`).

**Files:**

- Create: `src/lib/study/model.ts`, `src/lib/study/layout.ts`, `src/lib/study/index.ts`
- Create: `src/lib/study/model.test.ts`, `src/lib/study/layout.test.ts`
- Modify: `src/lib/index.ts` (`export * from './study';`)

**Interfaces:**

- Consumes: `LibraryEntry` (`@/types`), `GroupBy`, `groupEntries`, `navKey`, `contentKey`.
  `src/lib` is an ancestor of `src/lib/study`, so these are imported by file through the alias
  (`@/lib/group-entries`, `@/lib/library-params`), never through `@/lib`.
- Produces:

```ts
export type Tone = 1 | 2 | 3 | 4 | 5;
export type StudyGroupBy = Extract<GroupBy, 'series' | 'author'>;
export const STUDY_GROUP_BYS: readonly StudyGroupBy[];

export interface SpineDims {
  width: number;
  height: number;
  depth: number;
}

export interface StudyBook {
  id: number;
  navKey: string;
  title: string;
  authors: string[];
  series: string | null;
  seriesIndex: number | null;
  hasCover: boolean;
  tone: Tone;
  cjk: boolean;
  dims: SpineDims;
}

export interface StudyShelf {
  key: string;
  label: string;
  count: number;
  continued: boolean;
  books: StudyBook[];
}

export interface StudyModel {
  shelves: StudyShelf[];
  key: string;
}

export function isStudyGroupBy(value: GroupBy | null): value is StudyGroupBy;
export function spineDims(id: number): SpineDims;
export function spineTone(id: number): Tone;
export function isCjk(title: string): boolean;
export function buildStudyModel(
  entries: readonly LibraryEntry[],
  groupBy: StudyGroupBy,
): StudyModel;

export const MODEL_PX_PER_UNIT = 100;
export const ROW_H = 2.6;
export const FRONT_Z = 0.1;
export const BOOK_GAP = 0.015;
export const GROUP_GAP = 0.5;

export interface PlacedBook {
  book: StudyBook;
  shelfKey: string;
  row: number;
  order: number;
  x: number;
  y: number;
  t: number;
  h: number;
  d: number;
}

export interface Board {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
}

export interface ShelfLabel {
  shelfKey: string;
  text: string;
  count: number;
  continued: boolean;
  row: number;
  x: number;
  top: number;
}

export interface StudyLayout {
  books: PlacedBook[];
  boards: Board[];
  labels: ShelfLabel[];
  rows: number;
  width: number;
}

export function layoutShelves(
  shelves: readonly StudyShelf[],
  widthUnits: number,
): StudyLayout;
export function studyNavItems(layout: StudyLayout): NavItem[];
export function booksInRow(layout: StudyLayout, row: number): PlacedBook[];
```

- [ ] **Step 1: Write the failing tests**

`model.test.ts` builds entries with a local `entry(id, group?)` helper over made-up titles and
asserts:

- `spineDims(1)` is `{ width: 33, height: 185, depth: 122 }` and every id in 1..250 stays within
  `26..41` × `172..209`.
- `spineTone(5) === 1`, `spineTone(9) === 5` (P15, `chart-(id % 5 + 1)`).
- `isCjk('霧中的書店')` and `isCjk('海港來信')` are true; `isCjk('The Lamplighter’s Year')` and
  `isCjk('Two Clocks at Low Water')` are false. The test is the spike's
  `/[　-鿿＀-￯]/`.
- `buildStudyModel` keeps `groupEntries` order (P6), so the fallback group is last; `count` is
  `group.total`, not the books on the page; `continued` follows `offset > 0`; `navKey` matches
  `navKey(entry)`; `key` equals `contentKey(entries)`, so two equal arrays give the same key (P14).
- `isStudyGroupBy('tag')` and `isStudyGroupBy(null)` are false.

`layout.test.ts` asserts, for shelves built from the helper:

- Books are placed left to right; `order` is 0..n-1 in reading order; `x` is the book centre.
- Two shelves that fit on one row get a divider board between them and `GROUP_GAP` of space.
- A shelf whose first three books do not fit after the previous shelf starts a new row (the
  spike's rule), and a shelf longer than the row wraps book by book.
- One floor board per row, `rows` equals the highest `row + 1`, `width` echoes the argument.
- Labels: one per (shelf, row) segment; the first segment of a shelf that continues from an
  earlier page and every wrapped segment have `continued: true`; `top` is the row's top.
- `studyNavItems` returns `{ key: navKey, row, order, col: x }` with no `rect`, and `pickTarget`
  from `@rainforest-dev/rainforest-ui/interaction` over them moves `ArrowDown` to the nearest `x`
  on the next row, `Home`/`End` to the ends of the physical row (P10), and stops at page edges.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm nx test personal-calibre -- src/lib/study`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`layoutShelves` is the spike's `shelfLayout.ts` rewritten over `StudyShelf` (same constants,
same row-break rule, `dims / MODEL_PX_PER_UNIT`), plus the labels. Sketch of the per-book loop:

```ts
for (const book of shelf.books) {
  const t = book.dims.width / MODEL_PX_PER_UNIT;
  const h = book.dims.height / MODEL_PX_PER_UNIT;
  if (x + t > widthUnits && x > 0) {
    row += 1;
    x = 0;
    labels.push(labelAt(shelf, row, 0, true));
  }
  books.push({
    book,
    shelfKey: shelf.key,
    row,
    order: books.length,
    x: x + t / 2,
    y: -row * ROW_H + h / 2,
    t,
    h,
    d: book.dims.depth / MODEL_PX_PER_UNIT,
  });
  x += t + BOOK_GAP;
}
```

- [ ] **Step 4: Run the tests, typecheck and lint**

Run: `pnpm nx test personal-calibre -- src/lib/study` (PASS),
`pnpm nx typecheck personal-calibre`, `pnpm nx lint personal-calibre`.

- [ ] **Step 5: Comment and MCP checks, commit**

Run the comment grep and the MCP diff check from Global Constraints. Commit
`feat(personal-calibre): Study model and shelf layout`.

**Verification:** unit tests only; no UI. Fixture: none (in-test made-up entries, titles reuse
the seed's style: `The Salt Archive`, `霧中的書店`).

---

### Task 2: Renderer resolution, preview seam and the debug flag

Spec: P3, P20, P23; URL table (`renderer`); Cookie; Testing › `prefs` and `pickRenderer`
(param, cookie, default, fallback); Copy › Study.

**Files:**

- Create: `src/lib/study/renderer.ts`, `src/lib/study/renderer.test.ts`
- Modify: `src/lib/study/index.ts`, `src/lib/prefs.ts` (delete `resolveRenderer`),
  `src/lib/prefs.test.ts` (move its `resolveRenderer` cases to `renderer.test.ts`),
  `src/lib/library-params.ts` (`ParamPatch.renderer`, `isDebug`),
  `src/lib/library-params.test.ts`

**Interfaces:**

- Consumes: `Renderer`, `RENDERERS`, `DEFAULT_PREFS` (`@/lib/prefs`).
- Produces:

```ts
export type ThreeRenderer = Exclude<Renderer, 'css'>;
export type StudyBackend = 'webgpu' | 'webgl2' | 'css';

export const ENABLED_RENDERERS: readonly Renderer[];
export const PREVIEW_RENDERERS: readonly Renderer[];
export const RENDERER_LABELS: Record<Renderer, string>;

export interface RendererInput {
  param: string | null;
  pref: Renderer;
  sessionFallback: boolean;
  enabled?: readonly Renderer[];
  preview?: readonly Renderer[];
}

export function pickRenderer(input: RendererInput): Renderer;
export function isThreeRenderer(renderer: Renderer): renderer is ThreeRenderer;
export function backendLabel(
  renderer: Renderer,
  backend: StudyBackend | null,
): string;

export interface ParamPatch {
  renderer?: Renderer | null;
}
export function isDebug(input: SearchParamsInput): boolean;
```

`RENDERER_LABELS` is `{ 'three-tsl': 'three.js · WebGPU', css: 'CSS', 'three-glsl':
'three.js · GLSL' }`; the GLSL label is unused until phase 3.

- [ ] **Step 1: Write the failing tests**

`renderer.test.ts`:

- default: no param, cookie default (`three-tsl`), with `enabled: ['three-tsl', 'css']` →
  `three-tsl`; with the phase-2 interim lists (`['css']`, preview `['three-tsl']`) → `css`.
- `?renderer=css` beats the cookie; `?renderer=three-tsl` works when it is only preview;
  `?renderer=three-glsl` and `?renderer=nope` are ignored (D2).
- a cookie naming a preview-only renderer is ignored (preview is URL-only).
- `sessionFallback: true` returns `css` whatever the param and cookie say (D3).
- `backendLabel('three-tsl', 'webgpu') === 'three-tsl · WebGPU'`,
  `backendLabel('three-tsl', 'webgl2') === 'three-tsl · WebGL2 fallback'`,
  `backendLabel('css', 'css') === 'css'`, and `backendLabel('three-tsl', null)` reads
  `three-tsl · starting`.

`library-params.test.ts` adds: `buildLibraryHref(current, { renderer: 'css' })` sets it, `null`
removes it, neither changes `page`; `isDebug` is true for `?debug` and `?debug=1`, false
otherwise; `Clear all` keeps `renderer` and `debug` (they are not filters).

`prefs.test.ts` keeps its cookie cases (bad JSON, unknown renderer → `three-tsl`).

- [ ] **Step 2: Run, see FAIL; implement; run, see PASS**

Run: `pnpm nx test personal-calibre -- src/lib/study/renderer.test.ts src/lib/prefs.test.ts src/lib/library-params.test.ts`

- [ ] **Step 3: Typecheck, lint, comment and MCP checks, commit**

`resolveRenderer` has no caller outside tests on `main` (check with
`grep -rn resolveRenderer apps/personal-calibre/src` before deleting). Commit
`feat(personal-calibre): resolve the Study renderer with a preview seam`.

**Verification:** unit tests. Fixture: none.

---

### Task 3: E2E support for Study

Spec: Fixtures (made-up only), Testing › Playwright › Study (per renderer and backend, WebGPU
headed, WebGL2 forced by deleting `navigator.gpu`, `--disable-webgl` project).

**Files:**

- Modify: `apps/personal-calibre-e2e/src/support/seed.ts` (covers, D16)
- Create: `apps/personal-calibre-e2e/src/support/study.ts`
- Modify: `apps/personal-calibre-e2e/playwright.config.ts`
- Modify: `apps/personal-calibre-e2e/src/fixtures.spec.ts` (cover cases)

**Interfaces:**

- Produces from `seed.ts`: `COVER_IDS: readonly number[]` (ids with `id % 10 === 7`),
  `hasCover(id): boolean`.
- Produces from `support/study.ts`:

```ts
export type StudyRun =
  { renderer: 'css' } | { renderer: 'three-tsl'; backend: 'webgpu' | 'webgl2' };

export const STUDY_RUNS: readonly StudyRun[];
export function runName(run: StudyRun): string;
export async function prepareRun(page: Page, run: StudyRun): Promise<void>;
export async function gotoStudy(
  page: Page,
  run: StudyRun,
  query?: string,
): Promise<void>;
export function studyOptions(page: Page): Locator;
export function shelves(page: Page): Locator;
export function canvasWrap(page: Page): Locator;
export function collectConsole(page: Page): () => string[];
export async function hasWebGpu(page: Page): Promise<boolean>;
```

`prepareRun` adds the init script that deletes `navigator.gpu` for the `webgl2` run (the spike's
`Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined })`). `gotoStudy`
loads `/?view=study&groupBy=series&renderer=<r>` plus `query`, waits for `[data-library-ready]`
and for `[data-study-ready]` (Task 4 adds it; Task 6 sets it after the first frame for three.js).
`collectConsole` records `error` and `warning` messages minus the D23 allowlist.

Projects in `playwright.config.ts`:

- `chromium`: adds `launchOptions: { args: ['--enable-unsafe-swiftshader'] }` (D17) and ignores
  `*.no-webgl.spec.ts` and `study-parity.spec.ts`.
- `study-webgpu`: Desktop Chrome, `headless: false`,
  `args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist']`, `testMatch` the Study specs and
  `study-parity.spec.ts`, and only when `CALIBRE_WEBGPU=1` (headed runs cannot run unattended).
- `no-webgl`: `args: ['--disable-webgl', '--disable-webgl2']`,
  `testMatch: /\.no-webgl\.spec\.ts$/`. Its specs also delete `navigator.gpu` through
  `prepareRun`, so the run does not depend on whether headless Chromium hands out an adapter.
  Step 4 confirms `getContext('webgl2')` returns `null` there.

- [ ] **Step 1: Write the failing fixture tests**

In `fixtures.spec.ts`: `/api/books/7/cover` and `/api/books/27/cover` answer 200 with a body
that starts with the PNG signature; `/api/books/1/cover` answers 404; `/api/books?limit=100`
reports `hasCover` true exactly for `COVER_IDS`.

- [ ] **Step 2: Implement the covers**

`seed.ts` gains a `solidPng(width, height, rgb)` writer (IHDR, one IDAT through
`zlib.deflateSync`, `zlib.crc32` from Node 24) and writes a 256×384 two-block cover per
`COVER_IDS` book into its directory. Colours are fixed made-up values in the seed (test data, not
UI tokens). `has_cover` is `1` for those ids.

- [ ] **Step 3: Run the whole existing suite**

Run: `pnpm nx e2e personal-calibre-e2e` (all phase-1 specs plus the new cases).
Expected: PASS. Books 7, 17, 27, … now show a cover image in Shelf and the pane; if a phase-1
spec asserted the spine-colour fallback on one of those ids, move that assertion to an id
without a cover (any id not ending in 7) and say so in the commit body.

- [ ] **Step 4: Check the projects**

Run: `pnpm nx e2e personal-calibre-e2e -- --list --project=no-webgl` and
`--project=chromium`: the lists match the `testMatch`/`testIgnore` above.

- [ ] **Step 5: Comment and MCP checks, commit**

Commit `test(personal-calibre-e2e): made-up covers and Study run helpers`.

**Verification:** `fixtures.spec.ts` and a green full run. Fixture: small seed plus the generated
covers.

---

### Task 4: Study view, DOM layer and P8

Spec: Study › Shared model and DOM accessibility layer; P5, P7, P8, P9, P10, P14; Keyboard
(Study table, key hints); Loading (Study skeleton: three bays of 7 spines); Copy (`Bookshelves`,
`{label}, {N} books`).

**Files:**

- Create: `src/components/views/study/index.ts`, `StudyView.tsx`, `StudyListbox.tsx`,
  `StudyOption.tsx`, `StudySkeleton.tsx`
- Modify: `src/components/views/index.ts`, `src/components/library/ViewRegion.tsx`,
  `src/components/library/ViewSkeleton.tsx`, `src/components/library/SortControls.tsx`
- Modify: `src/hooks/useRovingNav.ts` (D8), `src/providers/LibraryProvider.tsx` (D10, P8 in
  `setView`)
- Modify: `src/app/(library)/page.tsx` (D9)
- Modify: `src/lib/prefs.ts` (`PREVIEW_VIEWS = ['study']`; `resolveView` honours enabled and
  preview views from `?view=`, enabled views only from the cookie), `src/lib/prefs.test.ts`
- Create: `apps/personal-calibre-e2e/src/study.spec.ts`

**Interfaces:**

- Consumes: Task 1 (`buildStudyModel`, `isStudyGroupBy`, `StudyModel`, `StudyBook`), Task 2
  (`pickRenderer`), `useRovingNav`, `useLibrary`, `GroupHeading`, `booksLabel`, `groupTitle`.
- Produces:

```ts
export type PendingFocus =
  | { kind: 'first'; page: number }
  | { kind: 'book'; id: number; orFirst?: true };

interface RovingOptions {
  navKeys: readonly string[];
  mode: NavMode;
  page: number;
  contentKey: string;
  items?: () => readonly NavItem[];
  scrollOnFocus?: boolean;
}

export interface StudyViewProps {
  entries: LibraryEntry[];
  groupBy: GroupBy | null;
  page: number;
}

export interface StudyOptionState {
  book: StudyBook;
  selected: boolean;
  open: boolean;
  tabIndex: 0 | -1;
}

export interface StudyRendererProps {
  model: StudyModel;
  page: number;
  options: StudyOptionState[];
  focusId: number | null;
  reducedMotion: boolean;
  nav: ReturnType<typeof useRovingNav<HTMLDivElement>>;
}

export interface StudyListboxProps {
  model: StudyModel;
  visibleHeadings: boolean;
  className?: string;
  renderOption: (state: StudyOptionState) => ReactNode;
  nav: StudyRendererProps['nav'];
}
```

`StudyOption` returns the attribute bag every renderer spreads on its option element:
`role="option"`, `aria-selected`, `aria-label="{title}, {authors}"`, `data-nav-key`,
`data-nav-row` (the shelf key), `data-book-id`, `data-open`, `tabIndex`, `onFocus`,
`onClick` (`openBook`, or `toggle` in phone select mode), `lang="zh-Hant"` when `cjk`.

`StudyView` builds the model with `useMemo` keyed on `contentKey` and `groupBy` (P14), resolves
the renderer with `pickRenderer`, and in this task renders a plain `StudyListbox` whose options
are visible text buttons (a placeholder replaced by `CssStudy` in Task 5). It sets
`data-study-ready` on its root once the model is built.

- [ ] **Step 1: Write the failing e2e**

`study.spec.ts` (run `css` only in this task; Task 12 loops it over `STUDY_RUNS`):

- `entering Study without a group sets groupBy=series` (P8): `gotoLibrary(page, '/?page=2')`,
  focus option for book 38 (`Tidewater Cycle · Book 2`), press `v` twice → URL has
  `groupBy=series`, no `page`; focus is on book 38's option if it is on page 1 of the series
  ordering, else on the first option (assert whichever the fixture gives, using `BOOKS` to
  compute it).
- `entering Study with Tag replaces it with series`: `/?groupBy=tag&view=study` server-redirects
  to `groupBy=series` (D9); Back from there goes to the previous entry without bouncing.
- `Study keeps Author grouping`: `/?groupBy=author&view=study` stays on `author`.
- `the Group select offers Series and Author only in Study` (D11).
- DOM layer: one `listbox` named `Bookshelves`; one `group` per shelf named
  `{label}, {N} books` where `N` is the group total (Northbound has 20 books, check against
  `SERIES`); options named `{title}, {authors}` with `aria-selected`.
- Keyboard: exactly one `tabindex="0"` option; `ArrowRight` crosses shelves in reading order;
  `ArrowDown` moves to another row (`data-nav-row` changes); `Home`/`End` stay in the row;
  `Ctrl+End` reaches the last option of the page; `x` and `Space` toggle `aria-selected`;
  `Enter` opens the pane on that book; `Esc` returns focus to it; `]` moves to page 2 and focuses
  its first option.
- Leaving Study with `v` keeps `groupBy=series` and focus stays on the same book.
- Skeleton: with the cookie set to `{ view: 'study' }` and `?__delay=1500`, the
  `[data-skeleton="study"]` element shows three bays.

- [ ] **Step 2: Implement `useRovingNav` options and `PendingFocus.orFirst`**

`items` replaces `collectItems(container, mode)` when present; `scrollOnFocus: false` makes
`focusElement` call only `focus({ preventScroll: true })`. In the pending-focus effect, a `book`
request with `orFirst` that finds no element falls back to the first visible option. Unit
coverage stays in `roving.test.ts`; add a `toNavItems` case only if the helper changes.

- [ ] **Step 3: Implement P8 (client and server)**

`setView(next)`: when `next === 'study'` and `!isStudyGroupBy(params.groupBy)`, call
`requestFocus(focusId !== null ? { kind: 'book', id: focusId, orFirst: true } : { kind: 'first', page: 1 })`
and `replaceParams({ groupBy: 'series' })` in the same handler as the view change.
`page.tsx` reads prefs (`readPrefs()` from `@/lib/server`), resolves the view and redirects as in
D9 before querying.

- [ ] **Step 4: Implement the view, listbox, skeleton and the Group select restriction**

`ViewRegion` renders `StudyView` for `view === 'study'` with `groupBy` narrowed by
`isStudyGroupBy` (P8 guarantees it after the redirect). `ViewSkeleton` gains the Study branch:
three bays, each a heading Skeleton and 7 spine Skeletons whose sizes follow `spineDims(i + r)`.

- [ ] **Step 5: Run and verify**

Run the new spec (`--grep "Study"`) and the whole suite (focus and pending-focus changes touch
every view). Load `/?view=study` from a dev server on the fixture: no console error.

- [ ] **Step 6: Comment and MCP checks, commit (no PR yet)**

Commit `feat(personal-calibre): Study view with the shared shelf listbox`.
`ENABLED_VIEWS` is still `['shelf', 'catalogue']`, so the switcher and `v` do not reach Study
yet; Study is reachable only through `?view=study` (`PREVIEW_VIEWS`, the same seam as D2). The
Step 1 cases that press `v` to enter Study are `test.fixme` here; Task 5 removes the marks and
empties `PREVIEW_VIEWS`.

**Verification:** `study.spec.ts` (css placeholder), full e2e suite, dev-server load. Fixture:
small seed; book 38, the Northbound series total.

---

### Task 5: `css` renderer and Study in the switcher

Spec: Study › `css` renderer; Decision 1 (three views); P15, P16, P19; Keyboard (focus,
selection and open cues in Study); Copy (`Study`, `書房 Study`).

**Files:**

- Create: `src/components/views/study/css/CssStudy.tsx`, `src/components/views/study/css/Spine.tsx`
- Create: `src/hooks/useReducedMotion.ts`; modify `src/hooks/index.ts`
- Modify: `src/components/views/study/StudyView.tsx` (render `CssStudy`)
- Modify: `src/app/globals.css` (`st-case`, `st-bay`, `st-row`, `st-slot`, `st-book`, `st-spine`,
  `st-cover`, `st-board`, `st-sel` as Tailwind `@layer components` rules over tokens)
- Modify: `src/lib/prefs.ts` (`ENABLED_VIEWS = ['shelf', 'catalogue', 'study']`,
  `PREVIEW_VIEWS = []`),
  `src/lib/prefs.test.ts` (`nextView` cycles three views)
- Modify: `src/components/library/ViewSwitch.tsx` (Study item, lucide `Library` icon, tooltip
  `書房 Study`)
- Modify: `tools/app-artifact/smoke.mjs` (check `{ path: '/?view=study&groupBy=series' }`)
- Modify: `apps/personal-calibre-e2e/src/study.spec.ts`, `src/a11y.spec.ts`
- Create: `apps/personal-calibre-e2e/src/study.phone.spec.ts`

**Interfaces:**

```ts
export function CssStudy(props: StudyRendererProps): ReactNode;

export interface SpineProps {
  state: StudyOptionState;
  scale: number;
  reducedMotion: boolean;
  optionProps: StudyOptionAttributes;
}
export function useReducedMotion(): boolean;
```

Rendering, per the spec's css section and the prototype's `V2Study`/`V2Spine`:

- Bays in `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`, `align-items: end`, one
  per shelf, `content-visibility: auto; contain-intrinsic-size: auto 300px`. Phone: one column,
  spines at `scale = 0.82`, horizontal scroll.
- Each bay: visible `GroupHeading` (`h2`, `{label}`, `N books`, `(continued)`), a `muted`
  gradient back panel, the row of spines with `padding-inline-end` of one cover width, a board
  `color-mix(in oklch, var(--foreground) 16%, var(--muted))`.
- `Spine`: the option element is the slot (`perspective: 900px`), sized from `spineDims × scale`;
  the stripe from D7; vertical title with `text-orientation: sideways` for Latin and `upright`
  when `cjk` (P16); author's last name. On hover or `:focus-visible` the book lifts 14px,
  `translateZ(40px)`, `rotateY(-52deg)`; `will-change: transform` only then; the cover face
  (`rotateY(90deg)` hinged on the right edge) mounts only then, showing
  `/api/books/{id}/cover` when `hasCover`, else the stripe with the title.
  Superseded on 2026-10-06: the pulled spine slides 12px up and the cover moves to the Study card
  (spec, Pull and the Study card).
- Cues: focus `outline-[2.5px] outline-foreground outline-offset-4` plus a 4px `foreground` bar;
  selection a `primary` inset ring and the `primary` check badge; open a 3px `primary` bar.
- Reduced motion: no transform; the spine brightens
  (`color-mix(in oklch, var(--foreground) 12%, transparent)` overlay) and the ring and bar stay.

- [ ] **Step 1: Write the failing tests**

- `study.spec.ts`: remove the `test.fixme` marks from Task 4; add `the switcher shows Study`
  (three items, `v` cycles Shelf → Catalogue → Study → Shelf), `css` cues (on a focused and
  selected spine the computed outline colour equals `tokenColor('--foreground')` and the check
  badge background equals `--primary`), `reduced motion keeps the ring and has no transform`
  (`emulateMedia({ reducedMotion: 'reduce' })`, computed `transform` on the hovered book is
  `none`), `CJK spines are upright` (books 44 and 45, `text-orientation: upright`), `Latin
apostrophes are sideways` (book 48), `the cover face shows the fixture cover` for book 7 (an
  `img` with `src` `/api/books/7/cover` appears on focus and is gone on blur).
- `study.phone.spec.ts` (390×844): one bay per row, no horizontal page scroll, spines scaled,
  key hints hidden, `Select` mode toggles from a spine.
- `a11y.spec.ts`: add `['study', '/?view=study&groupBy=series']`,
  `['study with the pane', '/?view=study&groupBy=series&book=38']`, and the phone file gains the
  Study page.

- [ ] **Step 2: Implement; run the Study specs, axe and the phone project**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "Study|accessibility"` and
`-- --project=phone --grep "Study|accessibility"`.

- [ ] **Step 3: Full suite, build, artifact**

Run: `pnpm nx run-many -t lint test typecheck -p personal-calibre personal-calibre-e2e`,
`pnpm nx e2e personal-calibre-e2e`, `pnpm nx build personal-calibre`,
`pnpm nx smoke-artifact personal-calibre` (the new check prints
`OK 200 text/html /?view=study&groupBy=series`).

- [ ] **Step 4: Visual check**

Dev server on the fixture, Study at 1440 and 390, light and dark: bays, spines, CJK titles,
the cover on book 7, focus vs selection colours. Capture with the
`rainforest-core:capture-evidence` skill for the PR (after-only: Study is a new surface).

- [ ] **Step 5: Comment and MCP checks, commit; open PR D**

Commit `feat(personal-calibre): CSS study and the third view`. PR D (Tasks 4 and 5) is opened
with `rainforest-core:create-pr` when the user asks, captures attached and labelled after-only.

**Verification:** `study.spec.ts`, `study.phone.spec.ts`, `a11y.spec.ts` (0 violations),
smoke-artifact, visual check. Fixture: small seed with covers; books 7, 38, 44, 45, 48.

---

### Task 6: three.js loading, the TSL renderer, fallback and the Renderer select

Spec: Decision 3 (renderers, `next/dynamic` only while Study shows), Decision 11 (requirements 1
and 6), P20, P23, Study › Renderer selection and loading, `three-tsl` renderer (factory,
`outputBufferType`, `NoToneMapping`, `init()`), Loading/error (`ThreeStudy` boundary), Copy,
Dependencies (phase 2).

**Files:**

- Modify: `apps/personal-calibre/package.json`, `pnpm-lock.yaml`
- Create: `src/components/views/study/three/loadThreeStudy.ts`, `ThreeStudy.tsx`,
  `ThreeStudyBoundary.tsx`, `kit.ts`, `kitTsl.ts`, `probe.ts`
- Create: `src/components/library/RendererSelect.tsx`, `src/components/library/BackendBadge.tsx`
- Modify: `src/components/library/LibraryToolbar.tsx` (the two new components are used only
  inside `components/library/`, so the barrel does not change)
- Modify: `src/providers/LibraryProvider.tsx`, `src/components/views/study/StudyView.tsx`
- Create: `apps/personal-calibre-e2e/src/study-three.spec.ts`,
  `apps/personal-calibre-e2e/src/study.no-webgl.spec.ts`,
  `apps/personal-calibre-e2e/src/study-bundle.spec.ts`

**Interfaces:**

```ts
interface LibraryContextValue {
  renderer: Renderer;
  setRenderer: (renderer: Renderer) => void;
  studyFallback: boolean;
  fallBackToCss: () => void;
  backend: StudyBackend | null;
  setBackend: (backend: StudyBackend | null) => void;
}

export type StudyGl = WebGPURenderer;

export interface KitCanvasProps {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: WebGLPowerPreference;
}

export interface StudyKit {
  renderer: ThreeRenderer;
  createRenderer: (props: KitCanvasProps) => Promise<StudyGl>;
  backendOf: (gl: StudyGl) => Exclude<StudyBackend, 'css'>;
  materials: StudyMaterials;
  compile: (gl: StudyGl, scene: Scene, camera: Camera) => Promise<void>;
  flat: boolean;
}

export interface ThreeStudyProps extends StudyRendererProps {
  renderer: ThreeRenderer;
  onBackend: (backend: Exclude<StudyBackend, 'css'>) => void;
  onStartFailed: (error: unknown) => void;
}

export interface StudyProbe {
  canvasMountAt: number;
  kitLoadMs: number;
  initMs: number;
  firstFrameAt: number | null;
  firstRenderMs: number | null;
  pulledId: number | null;
  info: () => StudyProbeInfo;
}

export interface StudyProbeInfo {
  backend: string;
  drawCalls: number;
  triangles: number;
  textures: number;
  texturesSizeReported: number;
  programs: number;
  atlasBytes: number;
  coversCached: number;
  dpr: number;
}
```

`kit.ts` holds only these types (`import type` from `three` and `three/webgpu`), so importing it
loads nothing. `StudyMaterials` is declared here and implemented in Task 7; in this task
`kitTsl.materials` is a minimal `MeshBasicNodeMaterial` set that draws boxes in the side colour,
enough to reach a first frame.

`kitTsl.createRenderer` (spec, `three-tsl` renderer):

```ts
export const createRenderer: StudyKit['createRenderer'] = async (props) => {
  const gl = new WebGPURenderer({
    ...props,
    antialias: true,
    outputBufferType: UnsignedByteType,
  });
  gl.toneMapping = NoToneMapping;
  await gl.init();
  return gl;
};
```

`loadThreeStudy.ts` is the only `next/dynamic` call:
`dynamic(() => import('./ThreeStudy'), { ssr: false, loading: StudySkeleton })`, in a
`'use client'` module. `ThreeStudy` loads the kit with `import('./kitTsl')` (a `switch` on
`renderer`, so phase 3 adds `case 'three-glsl': return import('./kitGlsl')`). The Canvas:
`frameloop="demand"`, `dpr={[1, 2]}`, `camera={{ fov: 30, near: 0.1, far: 200 }}`,
`shadows={false}`, `flat={kit.flat}`, `aria-hidden="true"`, inside a wrapper
`[data-study-canvas]` carrying `data-renderer`, `data-backend`, `data-pulled-id`.

`StudyView` picks: `css` → `CssStudy`; a three renderer → D13 capability check, then
`ThreeStudyBoundary` around the dynamic `ThreeStudy`, with the sr-only `StudyListbox` (Task 4)
rendered next to the canvas wrapper. `onStartFailed` and the boundary's `Use CSS study` both call
`fallBackToCss()` (D4, D5, D22). `RendererSelect` shows in the toolbar only in Study and only when
`ENABLED_RENDERERS.length > 1`; it calls `setRenderer` (cookie write, strips `?renderer`, as
`setView` strips `?view`). `BackendBadge` shows only with `isDebug(searchParams)`: a mono
`Badge` with `backendLabel(renderer, backend)`.

- [ ] **Step 1: Write the failing tests**

- `study-three.spec.ts` (`chromium` project, run `three-tsl`/`webgl2` via `prepareRun`):
  `?renderer=three-tsl` mounts a canvas whose wrapper has `data-renderer="three-tsl"` and, after
  `[data-study-ready]`, `data-backend="webgl2"`; the canvas is `aria-hidden`; `?debug` shows the
  badge `three-tsl · WebGL2 fallback`, and without `?debug` no badge; `?renderer=three-tsl` does
  not write the cookie; console is clean (D23).
- The same spec on `study-webgpu` (skipped with a note when `hasWebGpu` is false):
  `data-backend="webgpu"` and the badge `three-tsl · WebGPU`.
- `study.no-webgl.spec.ts`: `?renderer=three-tsl` lands on the css study
  (`data-renderer="css"`), the toast `3D isn't available here, showing the CSS study` shows once,
  a reload in the same tab shows no second toast and stays on css, and the cookie still has
  `renderer: 'three-tsl'`.
- A start failure: an init script that makes `HTMLCanvasElement.prototype.getContext` throw for
  `webgpu` and `webgl2` after the capability probe ran (count calls) → same fallback.
- `study-bundle.spec.ts` (`CALIBRE_BUDGETS=1`, `next start`): for `/`, `/books/1`, `/read/1` and
  `/?view=study&groupBy=series` with the css renderer, no loaded script contains
  `isWebGLRenderer` or `isWebGPURenderer` (D19); `/?view=study&groupBy=series&renderer=three-tsl`
  loads scripts that do, and only after the Study region mounts.

- [ ] **Step 2: Add the dependencies**

Run: `pnpm --filter @rainforest-monorepo/personal-calibre add three@0.186.1 @react-three/fiber@9.8.1`
and `pnpm --filter @rainforest-monorepo/personal-calibre add -D @types/three@0.186.0`.
Expected: exact versions in `package.json` (no caret; edit if pnpm adds one), lockfile changes,
no peer warning for React. `pnpm-workspace.yaml` has `minimumReleaseAge: 1440`; both versions
are older than a day.

- [ ] **Step 3: Implement the provider state, select, badge, loader, kit and boundary**

- [ ] **Step 4: Run the specs**

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "three|Study"`,
`-- --project=no-webgl`, and with `CALIBRE_WEBGPU=1 ... --project=study-webgpu` on a machine with
a GPU.

- [ ] **Step 5: Bundle and artifact checks**

Run: `pnpm nx build personal-calibre`, then the bundle spec on `next start` from the host
artifact:

```bash
APP_ARTIFACT_PLATFORM=host pnpm nx bundle personal-calibre
ART="${TMPDIR:-/tmp}/app-artifacts-host/personal-calibre"
grep -rl 'isWebGPURenderer' "$ART/apps/personal-calibre/.next/static" | head -3
grep -rl 'isWebGPURenderer' "$ART/apps/personal-calibre/.next/server" || echo none-on-server
```

Expected: static chunks contain it; the server output prints `none-on-server`. If Next emits an
SSR copy of the client chunk despite `ssr: false`, record it in the PR; it is harmless for the
image size budget but must not be imported at server start (the smoke run proves that).
Then `pnpm nx smoke-artifact personal-calibre` passes, and the bundle spec passes against the
artifact server started as in Task 13 step 1.

- [ ] **Step 6: Dev check, comment and MCP checks, commit**

Load `/?view=study&groupBy=series&renderer=three-tsl&debug` from the dev server. Commit
`feat(personal-calibre): load the TSL study renderer on demand with a CSS fallback`.

**Verification:** `study-three.spec.ts` (webgl2 headless, webgpu headed), `study.no-webgl.spec.ts`,
`study-bundle.spec.ts`, smoke-artifact. Fixture: small seed.

---

### Task 7: TSL materials (`studyMaterial.ts`)

Spec: Decision 11 and `three-tsl` requirements 2 (uniforms), 3 (one pulled-book material),
4 (`aCol`, `aSel`, `aHi`), 5 (no `TextureNode` offset/repeat); Decision 4 (one material for the
pulled book, side colour in `aCol`); "`studyMaterial.ts` is its only shader source".

**Files:**

- Create: `src/components/views/study/three/studyMaterial.ts`
- Create: `src/components/views/study/three/studyMaterial.test.ts` (see step 2)
- Modify: `kit.ts` (`StudyMaterials`), `kitTsl.ts`, `probe.ts` (`programs`, D15)
- Modify: `apps/personal-calibre/vitest.config.ts` only if step 2 needs `include` for `.tsx`
  (it does not: the test is `.ts`)

**Interfaces:**

```ts
export interface SpineMaterial {
  material: Material;
  setAtlas: (atlas: Texture | null) => void;
  setHighlight: (color: Color) => void;
  setSelection: (color: Color) => void;
}

export interface PulledBookFaces {
  cover: Texture | null;
  spine: Texture;
  side: Color;
  pages: Color;
}

export interface PulledBookMaterial {
  material: Material;
  point: (faces: PulledBookFaces) => void;
}

export interface StudyMaterials {
  spine: () => SpineMaterial;
  surface: (color: Color) => Material;
  pulledBook: () => PulledBookMaterial;
  dispose: () => void;
}

export const SPINE_ATTRIBUTES: {
  readonly spine: 'aSpine';
  readonly rect: 'aRect';
  readonly side: 'aCol';
  readonly selected: 'aSel';
  readonly highlight: 'aHi';
};
```

Shader contract (shared with phase 3's GLSL kit):

- Geometry attribute `aSpine` (float, 1 on the +Z face); instanced `aRect` (vec4 atlas rect),
  `aCol` (vec3 side colour), `aSel` (float), `aHi` (float).
- Spine `colorNode`: base = `aSpine > 0.5 && uHasAtlas > 0.5 ? atlas(aRect.xy + uv() * aRect.zw).rgb : aCol`;
  light = `0.62 + 0.38 * max(dot(normalWorld, normalize(vec3(0.3, 0.5, 1))), 0)`;
  out = `mix(mix(base * light, uSel, aSel * 0.22), uHi, aHi * 0.45)`. `uHasAtlas`, `uSel`,
  `uHi` are `uniform()`s; the atlas is `texture(placeholder, uvNode)` whose `.value` is set.
  The explicit UV maths replaces `texture.offset`/`repeat`; its one allowed comment names the
  `TextureNode` trap.
- Pulled book: one `MeshLambertNodeMaterial`, faces by `normalLocal` (x > 0.5 cover, z > 0.5
  spine, |y| > 0.5 pages, else side), `uHasCover` picks the cover texture or the side colour; every
  input is a uniform or a texture node `.value`. `point()` writes `.value`s only.
- Surfaces (back panel, boards): `MeshLambertNodeMaterial` with `color` set once per token change.

- [ ] **Step 1: Read three 0.186.1 for the program counter (D15)**

Read `node_modules/three/src/renderers/common/Info.js`, `Pipelines.js` and
`nodes/core/NodeBuilder.js` cache keys. Record in the commit body which counter
`StudyProbeInfo.programs` uses.

- [ ] **Step 2: Write the failing unit test**

`studyMaterial.test.ts` (node environment) imports `three/webgpu` and `./studyMaterial`:

- `spine()` twice returns two materials whose node graphs produce the same cache key (the key
  step 1 identified in `NodeBuilder`), so per-row materials share one program.
- `setHighlight`, `setSelection`, `setAtlas` change uniform/texture `.value`s and leave
  `material.version` unchanged.
- `pulledBook().point(...)` twice with different faces leaves `material.version` unchanged and
  the same node objects in place.
- No material sets `toneMapped`, and no texture has non-default `offset` or `repeat`.

If importing `three/webgpu` fails under Vitest's node environment (a top-level `navigator` or
`self` read), move these cases into `study-three.spec.ts` as an in-page test through the `?debug`
probe instead, and note it in the commit body; do not add jsdom for this.

- [ ] **Step 3: Implement, wire into `kitTsl`, run**

Run the unit test, then `study-three.spec.ts` on `webgl2` (and `webgpu` headed). Add to
`study-three.spec.ts`: `programs do not grow during a 40-step sweep` using
`window.__calibreStudy.info().programs` with `?debug` (Review Focus 4).

- [ ] **Step 4: Comment and MCP checks, commit**

Commit `feat(personal-calibre): TSL study materials on uniforms`.

**Verification:** unit test (or in-page fallback), `study-three.spec.ts` program-count case on
both backends. Fixture: small seed.

---

### Task 8: Shared scene: rows, pulled book, camera, pointer, reduced motion

Spec: Shared three.js scene (fiber `Canvas`, one `InstancedMesh` per shelf row, instanced
boards, back panel, the pulled book as its own mesh, token colours re-read on scheme change,
drei dropped); fixes 2 (camera clamp), 6 (reduced motion), 7 (tone mapping); Study DOM layer
(pointer pick focuses the option); P15.

**Files:**

- Create: `src/components/views/study/three/Scene.tsx`, `ShelfRow.tsx`, `PulledBook.tsx`,
  `tokens.ts`
- Create: `src/lib/study/scene-math.ts`, `src/lib/study/scene-math.test.ts`
- Modify: `ThreeStudy.tsx`, `probe.ts` (`projectBook`), `src/lib/study/index.ts`
- Modify: `apps/personal-calibre-e2e/src/study-three.spec.ts`

**Interfaces:**

```ts
export interface StudyProbe {
  projectBook: (bookId: number) => ScreenRect | null;
}

export interface CameraBounds {
  minY: number;
  maxY: number;
}
export function focusTargetY(layout: StudyLayout, row: number): number;
export function cameraBounds(
  layout: StudyLayout,
  viewHeightUnits: number,
  margin?: number,
): CameraBounds;
export function clampCameraY(y: number, bounds: CameraBounds): number;
export function wheelPan(
  y: number,
  deltaPx: number,
  pxPerUnit: number,
  bounds: CameraBounds,
): { y: number; consumed: boolean };

export type Rgb = readonly [number, number, number];
export const TOKEN_NAMES: readonly [
  'background',
  'card',
  'muted',
  'muted-foreground',
  'foreground',
  'primary',
  'border',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
];
export type Tokens = Record<(typeof TOKEN_NAMES)[number], Rgb>;
export function readTokens(): Tokens;
export function useTokens(): Tokens | null;

export interface SceneProps {
  layout: StudyLayout;
  tokens: Tokens;
  kit: StudyKit;
  focusId: number | null;
  selected: ReadonlySet<number>;
  reducedMotion: boolean;
  pxPerUnit: number;
  atlases: ReadonlyMap<number, RowAtlas>;
  onPick: (bookId: number) => void;
  onPulled: (bookId: number | null) => void;
  onCamera: (state: CameraState) => void;
}

export interface CameraState {
  y: number;
  bounds: CameraBounds;
}
```

Behaviour:

- One `ShelfRow` per layout row: an `InstancedMesh` of the row's books with its own
  `SpineMaterial` (Task 7), instance attributes `aRect`, `aCol` (D7 side colour), `aSel`
  (from `selected`), `aHi` (1 only for the focused book under reduced motion, highlight colour
  `foreground`), matrices from the layout; the pulled book's instance is scaled to zero.
- Boards are one instanced mesh; the back panel one plane; both use `materials.surface`.
- `PulledBook`: one mesh, one `PulledBookMaterial` created once per Scene; on focus change it
  calls `point()` and re-targets its tween (`home` → `out`, the spike's ease-out cubic, 4/s,
  rotation `-π/2 × 0.78`). Under reduced motion there is no pulled book (`onPulled(null)` and the
  `aHi` cue instead). `data-pulled-id` mirrors `onPulled`.
  Superseded on 2026-10-06: the book slides toward the camera without turning, a tap on the
  pulled book opens the pane, and a card shows it (spec, Pull and the Study card).
- Camera: x centred (`layout.width / 2`), y tweens to `focusTargetY` of the focused row and is
  clamped by `cameraBounds` (top and bottom board plus 0.3 units); under reduced motion it jumps.
  Distance from `pxPerUnit` and `fov` as in the spike. Wheel and touch call `wheelPan`; at a clamp
  (`consumed: false`) the event is not prevented, so the page scrolls on to the pager. The wheel
  listener is added with `{ passive: false }`, its one allowed comment naming React's passive
  `onWheel`.
- Pointer: `onClick` on a row instance or the pulled book calls `onPick(id)`, which focuses the
  matching option element (`[data-book-id]` inside the listbox) with `preventScroll`; hover sets
  `canvas.style.cursor` directly (drei dropped).
- Tokens re-read on `prefers-color-scheme` change and on `data-scheme` mutations of an ancestor,
  rebuilding materials' colours (uniforms) and atlases (Task 9).

- [ ] **Step 1: Write the failing tests**

`scene-math.test.ts`: `cameraBounds` for a case shorter than the view pins `minY === maxY` to the
centre; for a tall case the frustum edges equal the top/bottom boards plus the margin;
`clampCameraY` clamps both ends; `wheelPan` consumes inside the range and returns
`consumed: false` at either clamp in the scroll direction; `focusTargetY(layout, 0)` is within
the bounds.

`study-three.spec.ts` (`webgl2`, and `webgpu` headed):

- `the pulled book follows focus`: after each of `ArrowRight`, `ArrowDown`, `End`, `Ctrl+Home`,
  `data-pulled-id` equals the focused option's `data-book-id` (Review Focus 1).
- `a click on a spine focuses its option`: with `?debug`, read
  `window.__calibreStudy.projectBook(id)` (added to `StudyProbe` in this task, a `ScreenRect`
  for a placed book) for the third book of the first row, click its centre, then the active
  element is that book's option and `data-pulled-id` matches it.
- `reduced motion has no pull`: `emulateMedia({ reducedMotion: 'reduce' })` →
  `data-pulled-id` is empty while an option has focus.
- `the wheel scrolls the page at the clamp`: on a page whose case is shorter than the canvas,
  `mouse.wheel(0, 400)` over the canvas changes `window.scrollY`.
- `scheme change recolours`: `emulateMedia({ colorScheme: 'dark' })` and the canvas pixel at the
  back panel changes (sampled through a screenshot).

- [ ] **Step 2: Implement and run; full suite; dev check**

- [ ] **Step 3: Comment and MCP checks, commit**

Commit `feat(personal-calibre): shared three.js study scene`.

**Verification:** `scene-math.test.ts`, `study-three.spec.ts` on both backends, dev-server load in
light and dark. Fixture: small seed.

---

### Task 9: Per-shelf atlas

Spec: Shared scene fix 4 (one CanvasTexture per row, 160 px per unit, visible rows synchronously
before the first frame, the rest in `requestIdleCallback` nearest first, side colour until then,
disposed on page change); P14; Testing › Phase 2 (atlas build order); `three-tsl` requirement 6
and the texture-memory budget, with the owner's rule D25 (keep the budget, lower the atlas
resolution).

**Files:**

- Create: `src/components/views/study/three/atlas.ts`, `useRowAtlases.ts`
- Modify: `src/lib/study/scene-math.ts` (`atlasOrder`, `ATLAS_PPU_LADDER`, `atlasBytesAt`,
  `pickAtlasPpu`), `src/lib/study/scene-math.test.ts`
- Modify: `Scene.tsx`, `ShelfRow.tsx`, `probe.ts` (`atlasBytes`, `atlasPpu`)

**Interfaces:**

```ts
export const ATLAS_PPU_LADDER = [160, 128, 112, 96] as const;
export type AtlasPpu = (typeof ATLAS_PPU_LADDER)[number];
export const TEXTURE_BUDGET_BYTES = {
  desktop: 50 * 1024 * 1024,
  phone: 30 * 1024 * 1024,
} as const;

export interface TextureBudgetInput {
  layout: StudyLayout;
  budgetBytes: number;
  canvas: { width: number; height: number; dpr: number };
  msaaSamples: number;
  coverCacheBytes: number;
}

export function atlasBytesAt(layout: StudyLayout, ppu: number): number;
export function pickAtlasPpu(input: TextureBudgetInput): {
  ppu: AtlasPpu;
  estimatedBytes: number;
  fits: boolean;
};

export function atlasOrder(
  rows: number,
  visible: readonly number[],
): { sync: number[]; idle: number[] };

export type AtlasRect = readonly [number, number, number, number];
export interface RowAtlas {
  row: number;
  texture: CanvasTexture;
  rects: ReadonlyMap<number, AtlasRect>;
  bytes: number;
}
export function buildRowAtlas(
  books: readonly PlacedBook[],
  rowWidthUnits: number,
  tokens: Tokens,
  maxAnisotropy: number,
  ppu: AtlasPpu,
): RowAtlas;
export function cropSpine(atlas: RowAtlas, bookId: number): CanvasTexture;
export function useRowAtlases(args: {
  layout: StudyLayout;
  layoutKey: string;
  tokens: Tokens;
  visibleRows: readonly number[];
  maxAnisotropy: number;
  ppu: AtlasPpu;
}): ReadonlyMap<number, RowAtlas>;
```

Resolution rule (D25). `atlasBytesAt(layout, ppu)` sums, over every row, the row canvas
`ceil(width × ppu) × ceil(ROW_H × ppu) × 4` bytes with a 4/3 mipmap factor, the same count the
spike's `atlas.bytes` used. `pickAtlasPpu` subtracts the cover cache
(`COVER_CACHE_MAX × 256 × 384 × 4 × 4/3`) and the colour targets
(`width × height × dpr² × 4 × (1 + msaaSamples)`, the `UnsignedByteType` output buffer plus its
MSAA buffer) from `budgetBytes`, and returns the highest ladder rung whose atlas bytes fit; when
even 96 does not fit it returns 96 with `fits: false`. `ThreeStudy` calls it once per layout key
with `TEXTURE_BUDGET_BYTES.phone` below `lg` (D20) and `.desktop` otherwise, passes the rung to
`useRowAtlases`, and the probe reports `atlasPpu`. A `fits: false` result logs nothing at runtime;
Task 13 treats it as a finding. 96 is the floor because spine text below it stops being legible
at 1440 @2 (checked in step 2 on the CJK books 44 and 45).

`drawSpine` is the spike's `textures.ts` drawing (stripes, bands, rotated Latin title or upright
CJK characters, author's last name) over the D7 colours and `FONT_STACK`. `cropSpine` copies one
rect into its own canvas for the pulled book (requirement 5, no offset/repeat).
`useRowAtlases` builds `sync` rows during render setup (before the first frame), schedules `idle`
rows in `requestIdleCallback` batches, disposes on `layoutKey` change and unmount, and rebuilds
on token change.

- [ ] **Step 1: Write the failing tests**

`scene-math.test.ts`: `atlasOrder(6, [2, 3])` is `{ sync: [2, 3], idle: [1, 4, 0, 5] }` (nearest
first, ties to the lower row); an empty `visible` builds row 0 synchronously; out-of-range rows
are ignored. `atlasBytesAt` grows about fourfold from 80 to 160 ppu on the same layout and grows
with the row count. `pickAtlasPpu` returns 160 for a 30-book layout at 1440×900 @2 with the
desktop budget; returns a lower rung for a 250-book layout on the phone budget; walks down one
rung when `budgetBytes` drops by the difference between two rungs; returns
`{ ppu: 96, fits: false }` for a budget smaller than the fixed costs.

`study-three.spec.ts` (`?debug`, large fixture page size: `?__pageSize=250`, run with
`CALIBRE_FIXTURE=large` in the e2e env, as phase 1's budget spec does):
`info().atlasBytes` grows after idle time and every row has an atlas within 3 s;
the first frame happens before all atlases exist (`firstFrameAt` earlier than the last atlas);
after `]` the old textures are disposed (`info().textures` does not keep growing over three page
changes). `info().atlasPpu` is one of the ladder rungs, `info().atlasBytes` equals
`atlasBytesAt(layout, atlasPpu)` within 1%, and on the 30-book default page `atlasPpu` is 160.

- [ ] **Step 2: Implement and run; dev check; legibility floor**

Dev server on the large fixture, `?__pageSize=250&debug&renderer=three-tsl`, 1440 @2 and
390 @3: note `atlasPpu` for each. Force each rung once (a temporary local edit, not committed)
and capture books 44, 45 and 48 at 96 ppu: the CJK characters and the curly apostrophe stay
readable. If 96 is not readable, stop and report rather than lowering the floor.

- [ ] **Step 3: Comment and MCP checks, commit**

Commit `feat(personal-calibre): per-shelf spine atlases built visible rows first`.

**Verification:** `atlasOrder` and `pickAtlasPpu` unit tests; `study-three.spec.ts` atlas cases
on the large fixture; the legibility capture. Fixture: large seed (`CALIBRE_FIXTURE=large`,
250 books, `?__pageSize=250`) and the small seed's default page.

---

### Task 10: Next-page cover ids from `getLibrary`

Spec: Shared scene fix 5 ("The pager's next page's covers are prefetched (not uploaded) on
idle"); Server (`getLibrary` shape); P2 (paging over entries); P14. Owner decision D24 (PR #484):
the server returns what the prefetch needs.

**Files:**

- Modify: `src/types/calibre.ts` (`LibraryResult.nextPageCoverIds`)
- Modify: `src/lib/server/library-query.ts` (`queryLibrary`, `groupedPage`, `emptyResult`)
- Modify: `src/lib/server/library-query.test.ts`
- Modify: `src/test/calibre-db.ts` (`TestBook.hasCover`, written to `books.has_cover`)
- Modify: `apps/personal-calibre-e2e/src/pages.spec.ts`

Nothing else changes. `getLibrary` in `src/lib/server/queries.ts` already returns
`queryLibrary(query)` unchanged, so its `'use cache'` key (the `LibraryQuery`) and tag stay as
they are. The new code lives in the server-only `src/lib/server/` directory behind its existing
barrel; the type lives in `src/types/`, which client components already import (`ViewRegion`).
No file under `src/lib/server/mcp/`, `src/app/mcp/`, `src/app/api/mcp/` or `libs/mcp-kit/` is
touched: the MCP tools call `getBookList` and `getGroupedBookList`, not `getLibrary`.

**Interfaces:**

```ts
export interface LibraryResult {
  entries: LibraryEntry[];
  page: number;
  pageCount: number;
  matching: number;
  libraryTotal: number;
  matchingIds: number[];
  nextPageCoverIds: number[];
}

export interface TestBook {
  hasCover?: boolean;
}
```

`nextPageCoverIds` holds the distinct ids, in page order, of the books that page `page + 1`
shows and that have `has_cover = 1`, under the same filters, grouping and sort; `[]` when
`page >= pageCount` or when nothing matches. It holds at most `pageSize` ids (30 by default,
250 under `?__pageSize`), so the RSC payload grows by a few hundred bytes at most.

Implementation:

- Ungrouped: a second select over the same `where` and `buildOrderExpr`, `limit(pageSize)`,
  `offset(page * pageSize)`, selecting `books.id` and `books.hasCover`, filtered to covered ids
  in order. Skipped when `page >= pageCount`.
- Grouped: the same `entriesSql` CTE, a second `SELECT DISTINCT`-in-order over
  `r JOIN books b ON b.id = r.bid WHERE b.has_cover = 1 ORDER BY pos LIMIT ? OFFSET ?` with the
  next page's offset. A book in two tags appears once.
- `emptyResult` returns `nextPageCoverIds: []`.

- [ ] **Step 1: Write the failing unit tests**

In `library-query.test.ts`, add `hasCover: true` to a few made-up test books (the file's own
temp library, no seed data):

- `ungrouped: lists the covered books of the next page in order`: with a page size that splits
  the test library in three, page 1 returns exactly the covered ids of page 2 in title order;
  page 2 returns page 3's; the last page returns `[]`.
- `grouped by series: follows the entry order across a group boundary`: page 1's
  `nextPageCoverIds` equals the covered books among page 2's entries, in entry order.
- `grouped by tag: lists a book in two tags once`.
- `respects filters`: with a tag filter, only filtered covered books appear.
- `an out-of-range page returns no next-page ids`.
- The existing ungrouped-order test still matches `getBookList` (`BookSummary` untouched).

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm nx test personal-calibre -- src/lib/server/library-query.test.ts`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement; run the unit tests, typecheck and lint**

Run: `pnpm nx test personal-calibre`, `pnpm nx typecheck personal-calibre`,
`pnpm nx lint personal-calibre`.

- [ ] **Step 4: Write and run the e2e case**

`pages.spec.ts` gains `the page carries the next page's cover ids`: request `/` and
`/?groupBy=series` with the `RSC: 1` header and read the `nextPageCoverIds` array from the
payload; compare it as a set with the ids from `COVER_IDS` (Task 3) that page 2 of the same
listing shows (taken from `/?page=2` in the browser through the options' `data-book-id`). On the
last page (`/?page=3`) the array is empty.

Run: `pnpm nx e2e personal-calibre-e2e -- --grep "pages|mcp|budgets"` (budgets with
`CALIBRE_BUDGETS=1` against the artifact server, Task 13 step 1, to confirm the RSC payload of
`/` is still ≤ 60 KB).

- [ ] **Step 5: Artifact, comment and MCP checks, commit**

Run `pnpm nx smoke-artifact personal-calibre`, the comment grep and the MCP diff check
(it prints nothing). Commit
`feat(personal-calibre): return the next page's cover ids with the library page`.

**Verification:** `library-query.test.ts` (temp test library), `pages.spec.ts` and `mcp.spec.ts`
on the small seed with Task 3's covers, the budgets spec's RSC-payload case, smoke-artifact.
Fixture: small seed (70 books, covers on ids ending in 7, three pages).

---

### Task 11: Focus overlay, shelf headings, covers and prewarm

Spec: Shared scene fixes 1 (focus ring overlay, `onFocusRect`), 3 (shelf headings, `aria-hidden`,
`(continued)`), 5 (cover prewarm: `createImageBitmap` 256×384, `initTexture`, `compileAsync`,
next page prefetch); covers in an LRU of 24 for the pulled book ±4 (carried over); P15 (real cover
when there is one); Keyboard (focus `foreground` ring and 4px bar, selection `primary`); Testing
› Phase 2 (focus-rect projection helper).

**Files:**

- Create: `src/components/views/study/three/FocusOverlay.tsx`, `ShelfLabels.tsx`, `covers.ts`
- Modify: `src/lib/study/scene-math.ts` (`projectBox`), tests
- Modify: `Scene.tsx`, `ThreeStudy.tsx`, `probe.ts` (`coversCached`)
- Modify: `apps/personal-calibre-e2e/src/study-three.spec.ts`

**Interfaces:**

```ts
export type Vec3 = readonly [number, number, number];
export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
export function projectBox(
  corners: readonly Vec3[],
  viewProjection: ArrayLike<number>,
  viewport: { width: number; height: number },
): ScreenRect | null;

export interface SceneProps {
  onFocusRect: (rect: ScreenRect | null) => void;
  onLabels: (labels: readonly ProjectedLabel[]) => void;
}
export interface ProjectedLabel {
  shelfKey: string;
  text: string;
  count: number;
  continued: boolean;
  left: number;
  top: number;
}

export const COVER_W = 256;
export const COVER_H = 384;
export const COVER_CACHE_MAX = 24;
export interface CoverCache {
  get: (id: number) => Texture | null;
  ensure: (book: StudyBook) => Promise<Texture>;
  prefetch: (ids: readonly number[]) => void;
  dispose: () => void;
  size: () => number;
}
export function createCoverCache(tokens: Tokens): CoverCache;
```

- `Scene` projects the focused (or pulled) book's world-space box corners after every camera or
  pull change and reports `onFocusRect`; `FocusOverlay` draws an absolutely positioned box with
  `outline-[2.5px] outline-foreground` and a 4px `foreground` bar under it, visible only while an
  option in the listbox `matches(':focus-visible')`. Selection stays in the shader (`aSel`).
- `ShelfLabels` renders `aria-hidden` DOM labels (`text-sm`, `{label}` and `{count} books`,
  `(continued)` in `text-muted-foreground`) at the projected top-left of each label from the
  layout.
- Covers: `ensure` fetches `/api/books/{id}/cover` when `hasCover`, decodes with
  `createImageBitmap(blob, { resizeWidth: 256, resizeHeight: 384, imageOrientation: 'flipY' })`
  (its one allowed comment names three's `ImageBitmap` orientation trap), else draws the spike's
  `drawCover` canvas (title on the spine colour). LRU of 24.
- Prewarm, after the first frame: `ensure` the focused book ±4 and the first row, upload each
  with `gl.initTexture(texture)`, and `kit.compile` the pulled-book material once
  (`compileAsync` on `WebGPURenderer`). On idle after the prewarm, `prefetch` fetches
  `/api/books/{id}/cover` for every id in `library.nextPageCoverIds` (Task 10; fetch only, no
  decode, no upload, so the browser's HTTP cache holds them for the next page). `ViewRegion`
  passes `nextPageCoverIds` through `StudyView` to `ThreeStudy` as a prop.

- [ ] **Step 1: Write the failing tests**

`scene-math.test.ts`: `projectBox` with an identity view-projection maps the unit cube to the
full viewport; a box behind the camera returns `null`; a box partly off-screen is clipped to the
viewport.

`study-three.spec.ts`:

- `the focus overlay is visible and inside the canvas` after Tab into the listbox and after
  `ArrowDown`; it is hidden after a pointer click (no `:focus-visible`).
- `the overlay outline is foreground` (`tokenColor('--foreground')`).
- `shelf headings show labels and counts`: on `groupBy=series`, a label `Northbound` and
  `20 books` is visible and `aria-hidden`; on page 2 of the series ordering the first label reads
  `(continued)`.
- `the pulled book shows the fixture cover`: focus book 7 (`hasCover`), `info().coversCached`
  ≥ 1 and a network request to `/api/books/7/cover` happened; book 1 (no cover) issues no cover
  request.
- `the next page's covers are prefetched`: on a Study page whose next page holds a covered book
  (pick the page from `BOOKS` and `COVER_IDS` under `groupBy=series`), after idle the network log
  has a `GET /api/books/{id}/cover` for each id the next page holds with a cover, and none for
  books without one; on the last page no prefetch request happens.
- `the first pull after prewarm has no render spike`: with `?debug`, the max of
  `__renderMs` across the first five pulls after the first frame stays ≤ 25 ms on `webgpu`
  (headed only; recorded, not asserted, on headless `webgl2`).

- [ ] **Step 2: Implement and run; dev check in light and dark at 1440 and 390**

- [ ] **Step 3: Comment and MCP checks, commit**

Commit `feat(personal-calibre): study focus overlay, shelf headings and cover prewarm`.

**Verification:** `projectBox` unit tests; `study-three.spec.ts` overlay, heading and cover
cases on both backends. Fixture: small seed with covers (books 7, 17, 27); Northbound series.

---

### Task 12: E2E matrix, axe, visual parity and the bundle check

Spec: Testing › Playwright › Study (every bullet), axe (wcag2a/aa, wcag21aa, best-practice),
renderer-bundle check, visual parity ≤ 0.3% edge-only.

**Files:**

- Modify: `apps/personal-calibre-e2e/src/study.spec.ts`, `study.phone.spec.ts`,
  `study-three.spec.ts`, `a11y.spec.ts`, `study-bundle.spec.ts`
- Create: `apps/personal-calibre-e2e/src/study-parity.spec.ts`,
  `apps/personal-calibre-e2e/src/support/pixels.ts`

**Interfaces:**

```ts
export interface PixelDiff {
  total: number;
  mismatched: number;
  ratio: number;
  offEdge: number;
}
export async function diffScreenshots(
  page: Page,
  reference: Buffer,
  candidate: Buffer,
  tolerance?: number,
): Promise<PixelDiff>;
```

- [ ] **Step 1: Check the manifest (D19)**

After `pnpm nx build personal-calibre`, open `.next/react-loadable-manifest.json`. If it lists
the `ThreeStudy` and `kitTsl` chunks with their files, add a manifest assertion to
`study-bundle.spec.ts` (no `three` file in the first-load list of `/`, `/books/[id]`,
`/read/[id]`); otherwise record in the PR that the runtime scan is the check.

- [ ] **Step 2: Loop the keyboard, page and axe specs over `STUDY_RUNS`**

`study.spec.ts` and the Study cases in `a11y.spec.ts` run once per run in `STUDY_RUNS`
(`css`, `three-tsl`/`webgl2` on `chromium`; `three-tsl`/`webgpu` on `study-webgpu`). For each
three run add: no console errors (D23); `?debug` badge present, absent without it; the
focused option's id equals `data-pulled-id`; the overlay is inside the canvas bounds; reduced
motion shows no pull and a visible ring.

- [ ] **Step 3: Fallback and session behaviour on `no-webgl`**

The fallback cases are in Task 6. Extend `study.no-webgl.spec.ts` with: after the fallback the
`Renderer` select shows `CSS` as the current value while the cookie keeps `three-tsl`; choosing
`CSS` in the select does write `renderer: 'css'` to the cookie (a user choice, unlike the
fallback). Both cases need two enabled renderers, so they are `test.fixme` until Task 13 flips
`ENABLED_RENDERERS`, which removes the marks.

- [ ] **Step 4: Parity on `study-webgpu`**

`study-parity.spec.ts`: same viewport (1440×900, dpr 2), same fixture page, light and dark,
reduced motion on (no tween in the capture), focus on the first option; capture the canvas once
on WebGPU and once with `navigator.gpu` deleted; `diffScreenshots` → `ratio ≤ 0.003` and
`offEdge === 0` (D18). Print both numbers for the PR (the spike measured 0.028% / 0.038%).

- [ ] **Step 5: Run everything**

Run: `pnpm nx e2e personal-calibre-e2e`, `-- --project=phone`, `-- --project=no-webgl`,
`CALIBRE_WEBGPU=1 pnpm nx e2e personal-calibre-e2e -- --project=study-webgpu`, and the bundle
spec against the artifact server (Task 13 step 1 commands).

- [ ] **Step 6: Comment and MCP checks, commit**

Commit `test(personal-calibre-e2e): Study per renderer and backend, parity and bundle checks`.

**Verification:** the four project runs above, axe 0 violations per renderer. Fixture: small
seed with covers.

---

### Task 13: Perf sweep, budgets, the default flip and captures

Spec: Performance budgets (Study columns for `three-tsl` WebGPU, WebGL2 fallback and `css`,
desktop and phone emulation, `?__pageSize=250` on the large fixture); `three-tsl` requirement 6
(texture memory ≤ 50 MB desktop @2x, ≤ 30 MB phone, held by lowering atlas resolution per D25;
drop to `samples: 0` with HalfFloat if
`UnsignedByteType` fails parity); P20 default; visual check before each PR.

**Files:**

- Create: `apps/personal-calibre-e2e/perf/study-sweep.mjs`
- Modify: `apps/personal-calibre-e2e/package.json` (`perf-study` target:
  `node apps/personal-calibre-e2e/perf/study-sweep.mjs`)
- Modify: `src/lib/study/renderer.ts` (`ENABLED_RENDERERS = ['three-tsl', 'css']`,
  `PREVIEW_RENDERERS = []`), `renderer.test.ts`
- Modify: `apps/personal-calibre-e2e/src/visual.spec.ts` (Study surfaces, after-only)
- Modify: `apps/personal-calibre-e2e/src/study*.spec.ts` where a test relied on `css` being
  the default, and drop the Task 12 `test.fixme` marks
- Modify: `docs/superpowers/specs/2026-09-29-calibre-redesign-design.md` (status line: phase 2
  shipped, with the measured numbers)

**Interfaces:** the sweep script prints one JSON line per run:

```ts
interface SweepResult {
  label: string;
  boot: {
    canvasMountToFirstFrameMs: number;
    firstRenderCallMs: number;
    initMs: number;
    kitLoadMs: number;
    backend: string;
  };
  rafDelta: { median: number; p95: number; max: number };
  renderCpuMs: { median: number; p95: number; max: number };
  dropped: number;
  longTasks: number;
  programsBefore: number;
  programsAfter: number;
  drawCalls: number;
  rows: number;
  texturesSizeReported: number;
  focusPulledMismatches: number;
  console: string[];
}
```

- [ ] **Step 1: Start the production server from the host artifact on the large fixture**

```bash
node -r @swc-node/register -e "require('./apps/personal-calibre-e2e/src/support/seed').seedFixtures('large')"
APP_ARTIFACT_PLATFORM=host pnpm nx bundle personal-calibre
ART="${TMPDIR:-/tmp}/app-artifacts-host/personal-calibre"
FIX="$PWD/apps/personal-calibre-e2e/test-output/fixtures"
pids=$(lsof -tiTCP:3334 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
(cd "$ART" && CALIBRE_LIBRARY_PATH="$FIX" CALIBRE_APP_DB_PATH="$FIX/app.db" CALIBRE_E2E=1 \
  NODE_ENV=production PORT=3334 HOSTNAME=127.0.0.1 node apps/personal-calibre/server.js) &
until curl -sf http://127.0.0.1:3334/favicon.ico >/dev/null; do sleep 0.5; done
```

The seed call is the one `tools/app-artifact/smoke.mjs` runs (`runTs`, `@swc-node/register`),
with `large` instead of `small`.

- [ ] **Step 2: Port the sweep and run it headed**

`study-sweep.mjs` is the spike's `sweep3.mjs` and `common.mjs` reworked: it opens
`/?view=study&groupBy=series&__pageSize=250&debug&renderer=<r>` (`css`, `three-tsl` with and
without `navigator.gpu`), desktop 1440×900 @2 and phone 390×844 @3 with CPU ×4, reads the D14
probe, runs the 40-step sweep at 150 ms per step (`ArrowRight`, every tenth `ArrowDown`), and
also records `programs` before and after. The css run measures rAF, dropped frames and long tasks
only. It writes JSON to `apps/personal-calibre-e2e/test-output/perf/` (git-ignored).

Run: `BASE_URL=http://127.0.0.1:3334 HEADED=1 pnpm nx perf-study personal-calibre-e2e`.
Expected, per the spec's table: rAF median 16.7 / p95 ≤ 20 ms; dropped ≤ 10; long tasks 0;
`init()` ≤ 20 ms; first render call ≤ 60 ms (WebGPU) / ≤ 350 ms (WebGL2); mount → first frame
≤ 300 ms / ≤ 600 ms; render CPU max after prewarm ≤ 25 ms; program growth 0; draw calls at
most rows plus 6; reported texture memory ≤ 50 MB desktop, ≤ 30 MB phone. A timing miss is a
finding: report the number, do not raise the budget.

Texture memory follows D25 and is never restated. Record `atlasPpu`, `atlasBytes` and
`texturesSizeReported` per run. If the reported size is over budget while `pickAtlasPpu` said it
fits, the estimate is wrong: compute the unaccounted bytes (`texturesSizeReported` minus
`atlasBytes` minus the cover cache), fold that measured overhead into `pickAtlasPpu`'s
colour-target term as a named constant, update its unit test, and rerun until the reported size
fits. If it is over budget at 96 ppu, report it as a finding with the numbers. If parity fails
with `UnsignedByteType`, apply requirement 6's fallback (`samples: 0`, HalfFloat) in
`kitTsl.createRenderer`, pass `msaaSamples: 0` to `pickAtlasPpu` to match, and rerun the parity
spec and the sweep.

- [ ] **Step 3: Flip the default**

Set `ENABLED_RENDERERS = ['three-tsl', 'css']`, `PREVIEW_RENDERERS = []`; update
`renderer.test.ts` and any spec that assumed `css` by default. The `Renderer` select now shows
`three.js · WebGPU` and `CSS`.

- [ ] **Step 4: Full verification**

Run: `pnpm nx run-many -t lint test typecheck -p personal-calibre personal-calibre-e2e`,
`pnpm nx e2e personal-calibre-e2e` (all projects as in Task 12 step 5),
`pnpm nx smoke-artifact personal-calibre`, the bundle spec, `pnpm format:check`.

- [ ] **Step 5: Captures**

`CALIBRE_VISUAL=after` with Study surfaces (`study-css`, `study-tsl`, `study-tsl-webgl2`,
`study-pane`, phone), light and dark, 1440 and 390, on the fixture only. Use
`rainforest-core:capture-evidence`; attach with `rainforest-core:attach-pr-media`, labelled
after-only (new surface).

- [ ] **Step 6: Record and commit**

Update the spec's status line with the measured numbers. Commit
`feat(personal-calibre): make the TSL study the default renderer`, body carrying the sweep
table. Hand back the numbers, the parity ratios and the capture folder; the PR is opened when the
user asks.

**Verification:** headed sweep on both backends and css, desktop and phone emulation; parity
spec; full e2e; smoke-artifact; captures. Fixture: large seed (250 books) for the sweep, small
seed for e2e and captures.

---

## What to take from the spike and what to rewrite

| Spike file (`apps/personal-calibre/src/app/spike/study/`)  | Verdict       | Where it goes / why                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shelfLayout.ts` (`layoutShelves`, constants)              | Take, retype  | `src/lib/study/layout.ts` (Task 1). The row-break rule, `ROW_H`, `FRONT_Z`, gaps and boards are measured and fine. Retyped over `StudyShelf`, gains labels and `order`; `nearestInRow` is dropped for `pickTarget` over layout items, so `↑`/`↓`/`Home`/`End` match the other views.                                                           |
| `textures.ts` `dimsOf`                                     | Take          | `spineDims` (Task 1), same formula in prototype px (D6).                                                                                                                                                                                                                                                                                       |
| `textures.ts` `readTokens`, `mix`, `FONT_STACK`, CJK regex | Take          | `three/tokens.ts`, `atlas.ts`, `isCjk` (Tasks 1, 8, 9). The probe-and-canvas conversion turns oklch tokens into sRGB bytes reliably.                                                                                                                                                                                                           |
| `textures.ts` `drawSpine`, `drawCover`                     | Take, adapt   | `atlas.ts`, `covers.ts` (Tasks 9, 11). Drawing is good; colours move to D7 and the cover falls back to it only when the book has no real cover.                                                                                                                                                                                                |
| `textures.ts` `buildAtlas` (one 2048-wide atlas)           | Rewrite       | Per-row atlases built visible rows first (fix 4). The single atlas cost 300 to 500 ms of every first frame.                                                                                                                                                                                                                                    |
| `studyMaterial.ts`                                         | Take, rewrite | Keeps the spine node graph (explicit `aRect` UVs, `aCol`, `select` on `aSpine`, the light term). Adds `aSel`, `uHasAtlas`, `uSel` as uniforms; the pulled book becomes one material created once and re-pointed (the spike built a new one per pull from `cover`/`spine` constants).                                                           |
| `materialSet.ts`                                           | Rewrite       | Becomes `kit.ts` (`StudyKit`, `StudyMaterials`): adds `createRenderer`, `backendOf`, `compile`, `flat`, so phase 3 plugs in a whole kit, not a material set.                                                                                                                                                                                   |
| `kitWebGPU.ts`                                             | Take, extend  | `kitTsl.ts`: adds `outputBufferType: UnsignedByteType`, renderer-level `NoToneMapping`, `init()` timing. The spike relied on `flat` on the Canvas, which node renderers ignore per material.                                                                                                                                                   |
| `kitGlsl.ts`, `glslBook.ts`                                | Defer         | Phase 3. `glslBook.ts` lacks `aSel` and uses a six-material pulled book; phase 3 reworks it to the `kit.ts` contract.                                                                                                                                                                                                                          |
| `kitWebGLNodes.ts`                                         | Drop          | `WebGLNodesHandler` is out (decision 3): no bundle saving, broke multi-material meshes.                                                                                                                                                                                                                                                        |
| `Scene.tsx`                                                | Rewrite       | Keeps: instanced spines, instanced boards, back panel, pulled-book tween, camera distance from `pxPerUnit`, cover LRU of 24 with ±4 idle drawing, demand frameloop. Rewrites: one instanced mesh per row, no camera clamp → clamp, `useCursor` (drei) → direct cursor, the `gl.render` monkey-patch and `window.__study` → the `?debug` probe. |
| `StudySpike.tsx`                                           | Rewrite       | Its `nav`/`button` sr-only list, own key handler, dialog stub and scheme buttons are replaced by `StudyListbox` (`role="listbox"`/`group`/`option`), `useRovingNav`, the real pane and the shared theme. The async `gl` factory and `forceWebGL` pattern carry into `kitTsl` and the tests.                                                    |
| `StudyLoader.tsx`                                          | Take, adapt   | `loadThreeStudy.ts`, with `StudySkeleton` as `loading`.                                                                                                                                                                                                                                                                                        |
| `fixtures.ts`                                              | Drop          | The app's made-up seed (phase 1 Task 1) and its large mode replace it. The spike's CJK title generator is not needed: books 44 and 45 cover CJK.                                                                                                                                                                                               |
| `e2e/spike/common.mjs`, `sweep3.mjs`                       | Take, rework  | `perf/study-sweep.mjs` (Task 13): same launch args and sweep, reads the D14 probe, adds program count, css run, writes under `test-output`.                                                                                                                                                                                                    |
| `e2e/spike/keyboard.spec.mjs`                              | Rewrite       | Into `study.spec.ts` / `study-three.spec.ts` over `STUDY_RUNS`. It resolved `axe-core` by a `.pnpm` path; the suite already has `@axe-core/playwright`.                                                                                                                                                                                        |
| `e2e/spike/diff3.mjs`                                      | Rewrite       | `support/pixels.ts` (D18): in-browser diff, no `sharp` resolved from a `.pnpm` path.                                                                                                                                                                                                                                                           |
| `shots*.mjs`, `smoke*.mjs`, `sweep.mjs`, `sweep2.mjs`      | Drop          | Earlier rounds, superseded by round 3 and by `visual.spec.ts` captures.                                                                                                                                                                                                                                                                        |
| `package.json` (`@react-three/drei` 10.7.9)                | Drop drei     | Only `useCursor` was used.                                                                                                                                                                                                                                                                                                                     |

## Phase 3 seams left by this plan

- `StudyKit` in `three/kit.ts` is the contract a `kitGlsl.ts` implements: `createRenderer`
  (a `WebGLRenderer`), `backendOf` (always `webgl2`), `materials` with the same `SPINE_ATTRIBUTES`
  and one pulled-book material, `compile` (`gl.compile`), `flat: true`.
- `ThreeStudy` loads the kit through a `switch (renderer)` over `ThreeRenderer`; phase 3 adds the
  `three-glsl` case (`import('./kitGlsl')`), so `three/webgpu` never loads on that path.
- `RENDERER_LABELS['three-glsl']` exists; phase 3 adds `three-glsl` to `ENABLED_RENDERERS`, and
  the select and `backendLabel` (`three-glsl · WebGL2`) follow.
- `STUDY_RUNS`, the perf script's renderer list and `study-bundle.spec.ts` are lists; phase 3
  appends the GLSL run and the "`three/webgpu` absent from the GLSL path" assertion.
- The scene, overlay, labels, atlas, covers and camera live outside the kit and are reused as is.

## Repository constraints

- Docker image from prebuilt artifacts (#468): `three` and `@react-three/fiber` are client-only
  and loaded through `next/dynamic` with `ssr: false`, so they live in `.next/static`; Task 6
  checks the server output for them and runs `smoke-artifact`, and Task 5 adds the Study URL to
  the smoke checks. No new native module is added.
- MCP and gateway (#475, `/mcp`, `mcp-kit`) are untouched; every task checks the diff and keeps
  `mcp.spec.ts` green.
- Imports per CLAUDE.md `### Imports` (D1, Global Constraints): `src/lib/study` is pure and
  three-free; `views/study/three/` has no barrel and is reached only by dynamic import; no `../`;
  no barrel mixes client and server modules.

## Self-review

- Spec coverage. Study view → Tasks 4, 5. Shared model and DOM layer → Tasks 1, 4. `three-tsl`
  default → Tasks 6-11, flipped in 12. Its WebGL2 fallback backend → Tasks 6, 12 (forced
  `navigator.gpu` deletion), 12 (budgets). `css` alternative → Task 5. Renderer switch, `?renderer`
  and cookie per P20 → Tasks 2, 6, 13. `?debug` backend label (P23) → Tasks 2, 6, 12. `next/dynamic`
  only while Study shows → Tasks 6, 12 (bundle check). CSS fallback and toast (P20) → Task 6.
  `ThreeStudy` error boundary → Task 6. Decision 4 open items: focus ring overlay → Task 11;
  camera clamp → Task 8; shelf headings → Task 11; per-shelf atlas → Task 9; cover prewarm →
  Task 11; reduced motion → Tasks 5, 8; tone mapping off → Task 6; uniforms → Task 7; one
  pulled-book material → Task 7; `aCol` → Task 7. Decision 11 TSL lessons: 1 → Task 6; 2 → Task 7
  (program count in Tasks 7, 13); 3 → Task 7; 4 → Task 7; 5 → Tasks 7, 9 (`cropSpine`); 6 →
  Tasks 6, 13. P8 → Task 4. P10 (Study rows) → Tasks 1, 4. P14 → Tasks 1, 9 (D21). P15 → Tasks 1,
  5, 7. P16 → Tasks 1, 5, 9. P19 → Task 5. Loading (Study skeleton) → Task 4. Copy (Study) →
  Tasks 4-6. Budgets → Task 13. Testing › Phase 2 unit items → Tasks 1, 2, 8-11; Playwright Study
  items → Tasks 4-6, 8-12.
- Every task names its fixture and a runnable check.
- Types: `StudyRendererProps` (Task 4) is consumed by `CssStudy` (Task 5) and extended by
  `ThreeStudyProps` (Task 6); `StudyMaterials` is declared in Task 6 and implemented in Task 7;
  `SceneProps` grows in Tasks 8, 9 (`atlases`) and 11 (`onFocusRect`, `onLabels`); `StudyProbe`
  grows in Tasks 7 (`programs`), 8 (`projectBook`), 9 (`atlasBytes`, `atlasPpu`) and 11
  (`coversCached`); `LibraryResult.nextPageCoverIds` (Task 10) is read in Task 11.
- Owner decisions from PR #484 are recorded as D4, D5, D8 (kept), D24 (Task 10) and D25
  (Tasks 9, 13); the Study icon stays lucide `Library` (Task 5).

## Owner decisions (PR #484)

The questions this plan raised were answered by the owner on PR #484:

1. Fallback duration: tab-scoped. The automatic CSS fallback and the `Use CSS study` button both
   persist in `sessionStorage` only, never in the cookie (D4, D5).
2. `↓` in the css study moves to the next shelf in reading (DOM) order (D8).
3. Next-page cover prefetch: the server returns the next page's cover ids (D24, Task 10), and
   Task 11 prefetches them.
4. Texture budget: the budget stays; atlas resolution is lowered as needed (D25, Tasks 9 and 13).
5. Study icon: lucide `Library` (Task 5).
