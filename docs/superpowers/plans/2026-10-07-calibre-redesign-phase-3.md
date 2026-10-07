# personal-calibre redesign, phase 3 Implementation Plan

**Status:** done on 2026-10-07. Tasks 1 to 6 landed in #509, #510, #511, #508, #513 and #512;
Task 7 enables `three-glsl`. The measured numbers are in the spec's status section.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `three-glsl`, the second switchable alternative for 書房 Study: `WebGLRenderer`
with GLSL materials that match the TSL look, on the same kit contract, scene and DOM layer as
`three-tsl`. It must not load `three/webgpu` or TSL. Every phase 2 and 2.5 interaction (pull,
card, scrub cover-out, 3D inspect, headings, keyboard, reduced motion) must work identically on
it. It joins the `Renderer` select, `?renderer=`, the cookie, the `?debug` badge and the CSS
fallback. The same task fixes the select's backend mismatch, and the bundle, parity and budget
checks cover the new path.

**Architecture:** Phase 2 left a renderer-kit seam (`three/kit.ts`): `ThreeStudy` loads a
`StudyKit` through `loadKit(renderer)`, and the scene, rows, pulled-book carriers, atlas, covers,
overlay, labels and camera only talk to the kit. The kit is `createRenderer`, `backendOf`,
`programsOf`, `materials` (`spine()`, `surface()`, `pulledBook()`, `setDim()`, `dispose()`),
`compile` and `flat`. Phase 3 first widens the seam where shared code still reaches past it to
`WebGPURenderer`-only API (`getMaxAnisotropy`, `hasInitialized`, `info.render.drawCalls`,
`info.memory.texturesSize`) and keys the canvas by renderer. Then it adds `glslMaterial.ts` (the
GLSL port of `studyMaterial.ts`) and `kitGlsl.ts` (a `WebGLRenderer` factory), reached only
through `import('./kitGlsl')`. A lint rule keeps runtime imports of `three/webgpu` and
`three/tsl` inside the two TSL files. As in phase 2 (D2), the GLSL renderer lands as a preview
(`?renderer=three-glsl` only) and is enabled in the last task, once parity and budgets are
measured.

**Tech Stack:** unchanged from phase 2: Next.js 16.3 App Router with `cacheComponents: true`,
React 19.2 (catalog), `three` 0.186.1, `@react-three/fiber` 9.8.1, `@types/three` 0.186.0,
Vitest 4, Playwright with `@axe-core/playwright`. No new dependency. `WebGLRenderer` comes from
`three` core, which fiber already imports, so the GLSL path adds only the kit and its shaders.

**Spec:** `docs/superpowers/specs/2026-09-29-calibre-redesign-design.md`. Sections: Phases (row
3), Decisions 3, 4 and 11, P20, P23, Study › Pull and the Study card (revised 2026-10-06,
including scrub cover-out and 3D inspect), Renderer selection and loading, Shared three.js scene
and fixes, `three-glsl` renderer (phase 3), Performance budgets (`three-glsl` column), Copy
(Study), Testing › Playwright › Study. Phase 2 plan:
`docs/superpowers/plans/2026-10-05-calibre-redesign-phase-2.md` (its D-numbers are cited as
"phase 2 Dn"). This plan is written against `origin/main` at `9707951a` (#506).

**Spike:** local branch `spike/calibre-3d`, commit `864cc473`. `glslBook.ts` and `kitGlsl.ts`
are the starting point. Read them with `git show spike/calibre-3d:<path>`; never merge or check
the branch out. `glslBook.ts` has no `aSel`, no `uHasAtlas`, no dim and no back face, and builds
a six-material pulled book. Phase 3 rewrites it to the phase 2 contract.

## Plan decisions (where the spec is silent or cannot be followed literally)

- E1 The kit interface is generic over the renderer it creates, with method signatures.
  `StudyKit<Gl extends StudyGl = StudyGl>`, `StudyGl = WebGPURenderer | WebGLRenderer`. Method
  shorthand is bivariant under `strictFunctionTypes`, so `kitGlsl: StudyKit<WebGLRenderer>` and
  `kitTsl: StudyKit<WebGPURenderer>` both assign to `StudyKit`. Shared code only ever passes
  back the `gl` a kit created. `three/webgpu` stays a type-only import in `kit.ts`.
- E2 Shared code stops reaching past the kit. Four places read `WebGPURenderer`-only API:
  `AtlasScene` (`getMaxAnisotropy`), the cover cache upload in `ThreeStudy` (`hasInitialized`),
  `onFrame` (`info.render.drawCalls`) and the probe (`info.memory.texturesSize`). They move behind
  kit methods: `maxAnisotropy`, `uploadTexture`, `frameInfo`, `textureMemory`.
  `REPORTED_TARGET_BUFFERS` becomes `kit.reportedTargetBuffers`.
- E3 The canvas is keyed by renderer. `StudyView` renders `<LoadThreeStudy key={renderer} …>`.
  Today a switch from one three.js renderer to another keeps the mounted `Canvas`, and fiber's
  async `gl` factory runs once per mount, so the new kit would drive the old renderer. Phase 2
  never hit this because only one three.js renderer was enabled.
- E4 GLSL materials. Spine and side: one `ShaderMaterial` per row, unlit, matching
  `MeshBasicNodeMaterial.colorNode`. Pulled book: `MeshLambertMaterial` with `onBeforeCompile`
  and a constant `customProgramCacheKey`, so it uses three's own Lambert lighting, as
  `MeshLambertNodeMaterial` does, and both carriers share one program. Surfaces: plain
  `MeshLambertMaterial`. The TSL nodes and their GLSL ports are listed in Task 2. A
  `ShaderMaterial` with `lights: true` and a hand-written Lambert was considered: it would have
  to replicate three's light uniforms and risks a lighting mismatch that parity would then flag.
- E5 Shared shader constants move to `kit.ts`: `SPINE_MIX = { selection: 0.22, highlight: 0.45 }`
  and `SPINE_LIGHT = { base: 0.62, gain: 0.38, dir: [0.3, 0.5, 1] }`. `studyMaterial.ts`
  reads them instead of its private constants. `glslMaterial.ts` interpolates them into the
  shader source once at module load, so every spine material has identical source and one
  program.
- E6 Program counting on `WebGLRenderer`. `gl.info.programs` is the live program cache.
  `WebGLProgram.id` comes from a module-wide counter, so it cannot be used per renderer.
  `kitGlsl.programsOf` returns the number of distinct program ids seen in `gl.info.programs`. The
  ids are collected in `frameInfo`, which `onFrame` calls after every render. A program that is
  released and rebuilt during a sweep therefore still counts as growth, which is the same rule
  as the TSL kit's `createProgram` hook.
- E7 Texture memory on `WebGLRenderer`. `info.memory` has `textures` but no `texturesSize`.
  `kitGlsl.textureMemory` returns `{ textures, bytes: null }`. The probe then reports
  `texturesSizeSource: 'estimated'` with the sum of the measured atlas bytes, the cover cache,
  the inspect back canvas and the pulled-book spine crop. `kitGlsl.reportedTargetBuffers = 0`,
  because `WebGLRenderer` draws to the canvas's default framebuffer and reports no render-target
  textures. Owner decision 4: the estimate is held to the same caps as TSL, 50 MiB desktop and
  30 MiB phone.
- E8 Capability per renderer. `canStartThree()` becomes `canStartRenderer(renderer)`. `three-tsl`
  needs `navigator.gpu` or WebGL2; `three-glsl` needs WebGL2, since `WebGLRenderer` in 0.186 is
  WebGL2-only. P20's fallback applies to `three-glsl` unchanged: no WebGL2, or a throw while
  starting, switches to `css` for the tab (phase 2 D4) with the one toast (phase 2 D22), and the
  cookie is never written. `three-glsl` never falls over to `three-tsl` (owner decision 6).
- E9 Preview seam, as phase 2 D2. Tasks 3 to 6 land with
  `ENABLED_RENDERERS = ['three-tsl', 'css']` and `PREVIEW_RENDERERS = ['three-glsl']`, so
  `three-glsl` is reachable only through `?renderer=three-glsl` and a cookie asking for it
  resolves to the default. Task 7 sets `ENABLED_RENDERERS = ['three-tsl', 'three-glsl', 'css']`
  and `PREVIEW_RENDERERS = []`.
- E10 Bundle markers. Measured in `three@0.186.1/build`: `isWebGPURenderer` occurs only in
  `three.webgpu.js`; `isTextureNode` occurs only in `three.webgpu.js` (TSL texture nodes);
  `isWebGLRenderer` is in `three.core.js` and so is on both paths. `isNodeMaterial` is not
  usable, because `three.module.js` (the `WebGLRenderer` build) mentions it too. The GLSL kit's
  marker is the string literal `PULLED_BOOK_PROGRAM = 'calibre-pulled-book-glsl'` (its
  `customProgramCacheKey`), which survives minification.
- E11 Seam guard. A lint rule in `apps/personal-calibre/eslint.config.mjs` bans value imports
  from `three/webgpu` and `three/tsl` in `src/**`, except `kitTsl.ts`, `studyMaterial.ts` and
  `studyMaterial.test.ts`. It uses `@typescript-eslint/no-restricted-imports` with
  `allowTypeImports: true`, so `kit.ts` keeps its type import. A flat-config rule entry replaces
  the base config's entry, so the override repeats the base `../*` pattern and message. If the
  typescript-eslint rule is not registered for the app (check with
  `pnpm nx lint personal-calibre -- --print-config src/lib/index.ts`), use core
  `no-restricted-imports` and add `kit.ts` to the exceptions.
- E12 Parity pairs. GLSL is compared with TSL on the WebGL2 backend (headless, `chromium`
  project, SwiftShader) and with TSL on WebGPU (`study-webgpu`, headed). Captures cover the
  shelf with a focused book (phase 2's capture) and two new poses: the pulled book after a pull,
  and the inspect pose, which exercises the Lambert pulled-book material and the dim. Thresholds
  are owner decision 5.
- E13 Timing misses are findings, as in phase 2 Task 13: report the number, never raise a budget.
  Task 7 adds a mount-to-first-frame breakdown (`kitLoadMs`, `initMs`, atlas, first render) to
  the sweep output for every three.js run. It feeds the separate ticket for the phase 2 misses
  (owner decision 3); phase 3 does not try to close them.

## Global Constraints

Phase 2's Global Constraints apply unchanged. The ones every task touches:

- Work only in the worktree the controller names, on a branch cut from `origin/main`. Never `cd`
  to the repository root. Never `git stash`.
- Every task runs through `pnpm nx`:
  - Unit: `pnpm nx test personal-calibre -- <path>.test.ts`
  - Types: `pnpm nx typecheck personal-calibre` and `pnpm nx typecheck personal-calibre-e2e`
  - Lint: `pnpm nx run-many -t lint -p personal-calibre personal-calibre-e2e`
  - E2E: `pnpm nx e2e personal-calibre-e2e -- --grep "<title>"`, with `--project=<name>` where a
    task says so. The `study-webgpu` project needs `CALIBRE_WEBGPU=1` and runs headed.
  - Never call npm scripts, `vitest`, `playwright` or `next` directly.
- E2E servers: before and after every e2e run,
  `pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids`. Restore
  `apps/personal-calibre/next-env.d.ts` with `git checkout --` before every commit.
- Dev differs from build. A task that changes anything `next/dynamic` loads ends by loading
  `/?view=study&groupBy=series&renderer=three-glsl` and `…&renderer=three-tsl` from a running dev
  server on the fixture with no console error and no Next.js overlay.
- Imports follow CLAUDE.md `### Imports`:
  - `@/` alias across directories through the target's barrel; `./file` inside a directory;
    never `../`.
  - `views/study/three/` has no barrel. `kitGlsl` and `glslMaterial` are reached only through
    `import('./kitGlsl')` in `ThreeStudy.loadKit`. No shared file imports them, and no shared file
    imports `kitTsl` or `studyMaterial` (E11 enforces the TSL side).
  - `src/lib/study/` stays pure and three-free.
  - `import-x/no-cycle` stays green.
- Docker image from prebuilt artifacts (`nx bundle`, `tools/app-artifact/`, #468). No dependency
  or route is added. Tasks that change the lazy chunks (3, 7) end with
  `pnpm nx smoke-artifact personal-calibre`. three.js stays out of the traced server output.
- MCP and gateway untouched (#475). Last step of every task:
  `git diff --stat origin/main -- apps/personal-calibre/src/app/mcp apps/personal-calibre/src/app/api/mcp apps/personal-calibre/src/lib/server/mcp libs/mcp-kit`
  prints nothing, and `mcp.spec.ts` passes in the task's e2e run.
- Semantic tokens only. GLSL reads colours from uniforms and attributes fed by `readTokens`,
  never literals in shader source.
- Fixture data only: the seeded made-up library and the generated covers (phase 2 D16). No real
  books, authors or covers in tests, captures or PRs. Captures use `CALIBRE_FIXTURE=large` only
  for the sweep.
- Comment allow-list, in TypeScript and in GLSL source strings: one line naming an external
  constraint, the reason on a lint suppression, `TODO(<ticket>)`. Nothing else. Last step of
  every task: `git diff -U0 origin/main | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'` and justify each
  hit. GLSL `#include` and `#define` lines will match the grep. They are code, not comments; say
  so when justifying. Expected constraint lines: the `TextureNode` trap stays in
  `studyMaterial.ts`; `glslMaterial.ts` may carry one line saying the `onBeforeCompile` anchors
  are three's chunk names at 0.186.1.
- Copy verbatim from the spec's Copy section, as updated in PR #507.
- Commits: conventional, scope `personal-calibre` (or `personal-calibre-e2e`), path-scoped
  `git add`, never `--no-verify`, no signing flags, no `Refs:` trailer, and every message ends
  with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QYp97ZYgjC8sGokaNAwxxz
  ```

## Review Focus

1. Chunk separation, both ways. The `three-glsl` path loads nothing with `isWebGPURenderer` or
   `isTextureNode`; the `three-tsl` path loads nothing with `calibre-pulled-book-glsl`; no first
   load has any of them (Tasks 1, 3, 6).
2. Programs do not grow on GLSL. Selection, highlight, dim, pulled-book changes, the carrier
   swap, the float and inspect poses and atlas arrival only set uniform values; nothing sets
   `material.needsUpdate` or `.map` (Tasks 2, 3, 5).
3. One focus path and the same interactions on every three.js renderer. The phase 2 and 2.5
   specs run unchanged over the GLSL run (Task 5).
4. Switching between three.js renderers mounts a fresh canvas and renderer (E3, Tasks 1, 3, 7).
5. The select never names a backend the page is not using (Task 4).

## Execution order and pull requests

| Task | Title                                                    | Depends on | Pull request             |
| ---- | -------------------------------------------------------- | ---------- | ------------------------ |
| 1    | Kit seam: generic kit, renderer-neutral scene, key, lint | -          | PR A (own)               |
| 2    | GLSL materials (`glslMaterial.ts`)                       | 1          | PR B (own, not wired)    |
| 3    | `kitGlsl`, loading, capability and fallback (preview)    | 1, 2       | PR C (own, preview only) |
| 4    | Renderer labels, select mismatch and debug badge         | -          | PR D (own)               |
| 5    | Interaction parity e2e on GLSL                           | 3          | PR E (own, preview only) |
| 6    | Visual parity and bundle separation                      | 3          | PR F (own)               |
| 7    | Perf sweep, budgets, enable `three-glsl`, captures       | 4, 5, 6    | PR G (own; ships)        |

Task 1 comes first. Tasks 2 and 4 can then run in parallel; Task 4 touches only `src/lib/study/
renderer.ts`, `RendererSelect`, `BackendBadge`, and the provider's label read,
so it can even start before Task 1. Task 3 needs 1 and 2. Tasks 5 and 6 can run in parallel
after Task 3: they edit different spec files, and the shared `support/study.ts` change
(`StudyRun` gains `three-glsl`) lands in Task 3. Task 7 goes last because it flips
`ENABLED_RENDERERS`. Every PR before G is safe on `main`: `three-glsl` is reachable only through
`?renderer=three-glsl` (E9), and Tasks 1 and 4 change no behaviour on `three-tsl` beyond the
label fix.

The spec sizes phase 3 at about 4 tasks. This plan has 7, because Tasks 1, 4 and 6 are seam,
UI and test work that phase 2 left as named follow-ups, and splitting them keeps each PR to a few
hours.

## File map

Paths under `src/` are relative to `apps/personal-calibre/`; e2e paths are under
`apps/personal-calibre-e2e/`.

```
apps/personal-calibre/
  eslint.config.mjs                     three/webgpu, three/tsl seam guard          (T1)
  src/lib/study/renderer.ts             rendererLabel, enabled/preview lists         (T3, T4, T7)
  src/lib/study/renderer.test.ts                                                     (T3, T4, T7)
  src/lib/study/scene-math.ts           REPORTED_TARGET_BUFFERS moves to the kit     (T1)
  src/components/library/RendererSelect.tsx  backend-aware current label             (T4)
  src/components/library/BackendBadge.tsx    unchanged unless T4 needs the helper     (T4)
  src/components/views/study/capabilities.ts canStartRenderer                        (T3)
  src/components/views/study/StudyView.tsx   key={renderer}, canStartRenderer         (T1, T3)
  src/components/views/study/three/kit.ts    generic StudyKit, shared constants      (T1)
  src/components/views/study/three/kitTsl.ts new kit methods                         (T1)
  src/components/views/study/three/studyMaterial.ts  constants from kit.ts           (T1)
  src/components/views/study/three/ThreeStudy.tsx    kit methods, loadKit case       (T1, T3)
  src/components/views/study/three/useCoverPrewarm.ts no casts past the kit           (T1)
  src/components/views/study/three/probe.ts  texturesSizeSource                      (T1)
  src/components/views/study/three/glslMaterial.ts   GLSL port                       (T2)
  src/components/views/study/three/glslMaterial.test.ts                              (T2)
  src/components/views/study/three/kitGlsl.ts        WebGLRenderer factory           (T3)
apps/personal-calibre-e2e/
  playwright.config.ts                  parity on chromium for the WebGL2 pair       (T6)
  src/support/study.ts                  StudyRun + three-glsl, THREE_RUNS            (T3)
  src/study-three.spec.ts               describes loop over THREE_RUNS               (T3, T5)
  src/study.spec.ts, a11y.spec.ts       STUDY_RUNS gains three-glsl                  (T5)
  src/study.phone.spec.ts, study-touch.phone.spec.ts, study-inspect.phone.spec.ts    (T5)
  src/study.no-webgl.spec.ts            three-glsl falls back                        (T3, T7)
  src/study-parity.spec.ts              GLSL pairs and poses                         (T6)
  src/study-bundle.spec.ts              separation both ways, GLSL lazy budget       (T6)
  src/budgets.spec.ts                   atlas timing on the GLSL run                 (T5)
  src/visual.spec.ts                    study-glsl surfaces                          (T7)
  perf/study-sweep.mjs                  GLSL run, mount breakdown                    (T7)
docs/superpowers/specs/2026-09-29-calibre-redesign-design.md  status (T7)
```

---

### Task 1: Kit seam: generic kit, renderer-neutral scene, key, lint

Spec: Renderer selection and loading ("the GLSL path never loads `three/webgpu`"); Shared
three.js scene and fixes (phase 2, reused by phase 3); `three-glsl` renderer ("reuses the shared
scene and every fix above"). Phase 2 plan, Phase 3 seams.

**Files:**

- Modify: `src/components/views/study/three/kit.ts`, `kitTsl.ts`, `studyMaterial.ts`,
  `ThreeStudy.tsx`, `useCoverPrewarm.ts`, `probe.ts`
- Modify: `src/components/views/study/StudyView.tsx` (`key={renderer}`)
- Modify: `src/lib/study/scene-math.ts` (drop `REPORTED_TARGET_BUFFERS`; `TextureBudgetInput`
  keeps `targetBuffers`), `scene-math.test.ts`
- Modify: `apps/personal-calibre/eslint.config.mjs` (E11)
- Modify: `src/components/views/study/three/studyMaterial.test.ts` (kit contract cases)

**Interfaces:**

```ts
import type {
  Camera,
  Color,
  Material,
  Scene,
  Texture,
  WebGLRenderer,
} from 'three';
import type { WebGPURenderer } from 'three/webgpu';

import type { StudyBackend, ThreeRenderer } from '@/lib';

export type StudyGl = WebGPURenderer | WebGLRenderer;
export type ThreeBackend = Exclude<StudyBackend, 'css'>;

export interface KitFrameInfo {
  drawCalls: number;
  triangles: number;
}

export interface KitTextureMemory {
  textures: number;
  bytes: number | null;
}

export const SPINE_MIX = { selection: 0.22, highlight: 0.45 } as const;
export const SPINE_LIGHT = {
  base: 0.62,
  gain: 0.38,
  dir: [0.3, 0.5, 1],
} as const;

export interface StudyKit<Gl extends StudyGl = StudyGl> {
  readonly renderer: ThreeRenderer;
  readonly flat: boolean;
  readonly reportedTargetBuffers: number;
  readonly materials: StudyMaterials;
  createRenderer(props: KitCanvasProps): Promise<Gl>;
  backendOf(gl: Gl): ThreeBackend;
  programsOf(gl: Gl): number;
  frameInfo(gl: Gl): KitFrameInfo;
  textureMemory(gl: Gl): KitTextureMemory;
  maxAnisotropy(gl: Gl): number;
  uploadTexture(gl: Gl, texture: Texture): void;
  compile(gl: Gl, scene: Scene, camera: Camera): Promise<void>;
}
```

`StudyProbeInfo` (`probe.ts`) gains `texturesSizeSource: 'reported' | 'estimated'` next to
`texturesSizeReported`. `SPINE_ATTRIBUTES`, `SpineMaterial`, `PulledBookFaces`, `PulledBookMaterial` and
`StudyMaterials` are unchanged. `ThreeStudy`'s local `ThreeBackend` moves to `kit.ts`.

`kitTsl` implements the new methods with what the shared code does today:
`frameInfo = { drawCalls: gl.info.render.drawCalls, triangles: gl.info.render.triangles }`,
`textureMemory = { textures: gl.info.memory.textures, bytes: gl.info.memory.texturesSize }`,
`maxAnisotropy = gl.getMaxAnisotropy()`, `uploadTexture = gl.hasInitialized() &&
gl.initTexture(t)`, `reportedTargetBuffers = 2` (measured 2.002 desktop, 2.008 phone in #501).

- [ ] **Step 1: Write the failing tests**

  - `studyMaterial.test.ts`: `kit satisfies StudyKit<WebGPURenderer>` compiles, and a
    `StudyKit<WebGPURenderer>` assigns to `StudyKit` (a typed `const` line, checked by
    `typecheck`). `studyMaterial.ts` takes its mixes and light term from `SPINE_MIX` and
    `SPINE_LIGHT`: the test reads the source file and asserts none of the literals `0.22`,
    `0.45`, `0.62` or `0.38` is left in it.
  - `scene-math.test.ts`: `pickAtlasPpu` with `targetBuffers: 0` picks a rung at least as high
    as with `targetBuffers: 2` for the same layout (the GLSL case).
  - `study-three.spec.ts`, new case `switching between three.js renderers mounts a new canvas`.
    Mark it `test.fixme` until Task 3 makes `three-glsl` loadable. On `?renderer=three-tsl&debug`,
    hold the canvas element handle, then `history.replaceState` to `?…&renderer=three-glsl`.
    Next 16 syncs `useSearchParams` with the native History API. Expect `data-renderer`
    `three-glsl`, a different canvas element, and `data-backend` `webgl2`.

- [ ] **Step 2: Widen the kit and route shared code through it**

  `AtlasScene`: `useThree((s) => kit.maxAnisotropy(s.gl as unknown as StudyGl))`. Cover cache
  `upload`: `kit.uploadTexture(gl.current, texture)` when both exist. `onFrame`:
  `kit.frameInfo(gl.current)`. Probe `info()`: `kit.textureMemory`. When `bytes` is `null`,
  report the E7 estimate as `atlasBytes + coverCacheBytes + INSPECT_BACK_BYTES + spineCropBytes`,
  with `texturesSizeSource: 'estimated'`. `pickAtlasPpu({ targetBuffers:
kit.reportedTargetBuffers })`; this makes `pick` depend on `kit`, so `kit` joins its memo keys.
  `useCoverPrewarm`: drop the `as unknown as StudyGl` cast where the kit types now carry it.

- [ ] **Step 3: Key the canvas (E3)**

  `StudyView`: `<LoadThreeStudy key={renderer} …>`. The existing
  `useEffect(() => () => setBackend(null), [renderer, setBackend])` stays.

- [ ] **Step 4: Seam guard (E11)**

  Add the override and check it: put a temporary `import { WebGPURenderer } from
'three/webgpu'` in `Scene.tsx` and confirm lint fails, then remove it. Confirm that
  `import type` in `kit.ts` passes and that the `../*` rule still fires.

- [ ] **Step 5: Run**

  `pnpm nx test personal-calibre`, typecheck, lint, then
  `pnpm nx e2e personal-calibre-e2e -- --grep "Study three-tsl"` (chromium, `webgl2`) and the
  same under `CALIBRE_WEBGPU=1 … --project=study-webgpu`. Programs, draw calls and the probe's
  `texturesSizeReported` must equal `main`'s on the same page: compare `?debug` probe dumps
  before and after on `CALIBRE_FIXTURE=large`, `?__pageSize=250`.

- [ ] **Step 6: Comment and MCP checks, commit**

  `refactor(personal-calibre): route the study scene through the renderer kit`.

**Verification:** unit, typecheck, lint (including the deliberate failure in step 4),
`study-three.spec.ts` on both TSL backends, the probe comparison. Fixture: small seed with covers
for e2e, large for the probe comparison.

---

### Task 2: GLSL materials (`glslMaterial.ts`)

Spec: `three-glsl` renderer ("`aCol`, `aSel`, `aHi` attributes, one pulled-book material that
picks the face by `vNormal`, `flat` tone mapping"); Decision 4 (one material for the pulled book,
side colour in `aCol`, uniforms not constants); Decision 11 items 2 to 5 as they apply to GLSL;
Pull and the Study card › 3D inspect (back face, shared `dim` uniform, no scrim mesh).

**Files:**

- Create: `src/components/views/study/three/glslMaterial.ts`
- Create: `src/components/views/study/three/glslMaterial.test.ts`

**Interfaces:**

```ts
export const PULLED_BOOK_PROGRAM = 'calibre-pulled-book-glsl';
export const SPINE_VERTEX: string;
export const SPINE_FRAGMENT: string;
export function injectPulledBook(shader: {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { value: unknown }>;
}): void;
export function createGlslMaterials(): StudyMaterials;
```

TSL nodes in `studyMaterial.ts` and their GLSL ports:

| TSL (`studyMaterial.ts`)                                                       | GLSL (`glslMaterial.ts`)                                                                                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `attribute('aRect', 'vec4')`, `uv()`, `rect.xy.add(uv().mul(rect.zw))`         | vertex: `attribute vec4 aRect; vAtlasUv = aRect.xy + uv * aRect.zw;` (explicit rect maths, so `texture.offset`/`repeat` are never used) |
| `texture(placeholder, …)` with `.value` re-pointed                             | `uniform sampler2D uAtlas;` whose `.value` is re-pointed; the placeholder is a 1×1 `Texture` in `SRGBColorSpace`                        |
| `uniform(0)` `hasAtlas`                                                        | `uniform float uHasAtlas;`                                                                                                              |
| `select(aSpine > 0.5 && hasAtlas > 0.5, atlas.rgb, aCol)`                      | `vec3 base = (vSpine > 0.5 && uHasAtlas > 0.5) ? texture2D(uAtlas, vAtlasUv).rgb : vCol;`                                               |
| `light()`: `0.62 + 0.38 * max(dot(normalWorld, normalize(vec3(0.3,0.5,1))),0)` | vertex `vNormalWorld = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);`, fragment the same expression from `SPINE_LIGHT`  |
| `mix(…, selection, aSel * 0.22)`, `uniform(Color)` `selection`                 | `mix(lit, uSel, vSel * SELECTION_MIX)`, `uniform vec3 uSel;`                                                                            |
| `mix(…, highlight, aHi * 0.45)`, `uniform(Color)` `highlight`                  | `mix(…, uHi, vHi * HIGHLIGHT_MIX)`, `uniform vec3 uHi;`                                                                                 |
| `.mul(float(1).sub(dim))`, one `uniform(0)` shared by every spine material     | `* (1.0 - uDim)`; one `{ value: 0 }` object placed in every spine material's `uniforms`, so `setDim` writes it once                     |
| `MeshBasicNodeMaterial` (unlit), renderer `NoToneMapping`                      | `ShaderMaterial`, `gl_FragColor = vec4(color, 1.0);` then `#include <colorspace_fragment>`; `flat` on the Canvas                        |
| Pulled book `MeshLambertNodeMaterial.colorNode`, faces by `normalLocal`        | `MeshLambertMaterial` + `onBeforeCompile`: `varying vec3 vFaceNormal = normal; varying vec2 vFaceUv = uv;` after `#include <uv_vertex>` |
| `normalLocal.x > 0.5` → `hasCover ? cover : side`                              | replaces `#include <map_fragment>`: `vFaceNormal.x > 0.5 ? (uHasCover > 0.5 ? texture2D(uCover, vFaceUv).rgb : uSide)`                  |
| `normalLocal.x < -0.5` → `hasBack ? back : side` (#506)                        | `vFaceNormal.x < -0.5 ? (uHasBack > 0.5 ? texture2D(uBack, vFaceUv).rgb : uSide)`                                                       |
| `normalLocal.z > 0.5` → spine crop                                             | `vFaceNormal.z > 0.5 ? texture2D(uSpineFace, vFaceUv).rgb`                                                                              |
| `abs(normalLocal.y) > 0.5` → `pages`, else `side`                              | `abs(vFaceNormal.y) > 0.5 ? uPages : uSide`; result written to `diffuseColor.rgb`                                                       |
| Surfaces: `MeshLambertNodeMaterial`, `color` copied once                       | `MeshLambertMaterial`, `color` copied once; `Scene` keeps scaling it for the dim                                                        |

Things that are not in a shader and need no port: the spine stripes, the title text and the CJK
upright rule are drawn into the row atlas canvas (`atlas.ts`, P16). Covers and the inspect back
face are canvases (`covers.ts`). Token colours come from `tokens.ts`. All of these are shared.

Colour space: `toColor` yields linear `Color`s, so `aCol`, `uSel`, `uHi`, `uSide` and `uPages`
are linear in both kits. Atlas, cover, back and spine crop textures are `SRGBColorSpace`, so
`WebGLRenderer` samples them decoded, as the node renderer does.
`#include <colorspace_fragment>` converts to the sRGB output. With `flat`, there is no
tone-mapping chunk to include.

- [ ] **Step 1: Write the failing unit test**

  `glslMaterial.test.ts` (node environment, imports `three` core only):

  - Two `spine()` materials have identical `vertexShader` and `fragmentShader`, and the same
    `uniforms.uDim` object; `setDim(0.55)` is seen by both.
  - Every `SPINE_ATTRIBUTES` value appears as an `attribute` declaration in `SPINE_VERTEX`.
  - `setAtlas`, `setHighlight`, `setSelection` change `uniforms.*.value` and leave
    `material.version` unchanged. `setAtlas(null)` points at the placeholder and sets
    `uHasAtlas` to 0.
  - Two `pulledBook()` materials return `PULLED_BOOK_PROGRAM` from `customProgramCacheKey()`.
    `point()` twice with different faces leaves `version` unchanged, never sets `.map`, and
    writes `uHasCover` / `uHasBack` as the TSL kit does.
  - `injectPulledBook` on a copy of `ShaderLib.lambert` from three 0.186.1 replaces
    `#include <map_fragment>` and extends `#include <uv_vertex>`. The test fails if either anchor
    is missing, which guards a three upgrade.
  - No texture has a non-default `offset` or `repeat`. No material sets `toneMapped`.

- [ ] **Step 2: Implement**

  The spike's `glslBook.ts` is the starting point for the spine shaders. Add `aSel`, `uSel`,
  `uHasAtlas` and `uDim`, take the constants from `kit.ts` (E5), and replace the six-material
  pulled book with E4's single material. `dispose` frees the three placeholders, as
  `studyMaterial.ts` does.

- [ ] **Step 3: Comment and MCP checks, commit**

  `feat(personal-calibre): GLSL study materials on the kit contract`.

**Verification:** `pnpm nx test personal-calibre -- src/components/views/study/three/glslMaterial.test.ts`,
typecheck, lint (E11 must pass: this file imports only `three`). No e2e: nothing loads it yet.

---

### Task 3: `kitGlsl`, loading, capability and fallback (preview)

Spec: Decision 3 (`three-glsl` as a switchable alternative); Renderer selection and loading
(second dynamic import, `kitGlsl`); P20 fallbacks; P23 (`data-renderer`, `data-backend`, badge
`three-glsl · WebGL2`); Shared scene fix 5 (`compile` on `WebGLRenderer`), fix 7 (`flat`).

**Files:**

- Create: `src/components/views/study/three/kitGlsl.ts`
- Modify: `ThreeStudy.tsx` (`loadKit` case), `capabilities.ts`, `StudyView.tsx`
- Modify: `src/lib/study/renderer.ts` (`PREVIEW_RENDERERS = ['three-glsl']`), `renderer.test.ts`
- Modify: `apps/personal-calibre-e2e/src/support/study.ts`, `study-three.spec.ts`,
  `study.no-webgl.spec.ts`

**Interfaces:**

```ts
export const kit: StudyKit<WebGLRenderer>;

export function canStartRenderer(renderer: ThreeRenderer): boolean;

export type StudyRun =
  | { renderer: 'css' }
  | { renderer: 'three-tsl'; backend: 'webgpu' | 'webgl2' }
  | { renderer: 'three-glsl'; backend: 'webgl2' };
export type ThreeRun = Exclude<StudyRun, { renderer: 'css' }>;
export const THREE_RUNS: readonly ThreeRun[];
```

`kitGlsl`:

- `createRenderer`: `new WebGLRenderer({ ...props, antialias: true, powerPreference })`, then
  `gl.toneMapping = NoToneMapping`. It throws when `getContext('webgl2')` fails, which
  `createGl` already turns into `onStartFailed`.
- `backendOf`: `'webgl2'`.
- `programsOf`, `frameInfo`: E6. `frameInfo` reads `gl.info.render.calls` and `.triangles`.
- `textureMemory`: `{ textures: gl.info.memory.textures, bytes: null }` (E7).
- `maxAnisotropy`: `gl.capabilities.getMaxAnisotropy()`.
- `uploadTexture`: `gl.initTexture(texture)`.
- `compile`: `await gl.compileAsync(scene, camera)`.
- `reportedTargetBuffers: 0`, `flat: true`, `materials: createGlslMaterials()`.

`loadKit('three-glsl')` returns `import('./kitGlsl').then((m) => m.kit)`, replacing the phase 2
rejection. `PROJECT_RUNS` in `support/study.ts`: `chromium` gains `three-glsl-webgl2`, and
`study-webgpu` gains it too, so headed runs cover it on real GPU WebGL2. `prepareRun` leaves
`navigator.gpu` alone for GLSL, since the kit never reads it.

- [ ] **Step 1: Write the failing tests**

  - `renderer.test.ts`: `three-glsl` from `?renderer=` resolves while previewed; from the cookie
    it resolves to the default; the session fallback still wins.
  - `study-three.spec.ts`: the top describes (`mounts an aria-hidden canvas…`, `?debug shows the
backend badge and the probe`, `programs do not grow during a 40-step sweep`, `…full-page
walk`, `a renderer that throws while starting falls back…`) loop over `THREE_RUNS` filtered by
    project. For GLSL: `data-backend="webgl2"`, badge `three-glsl · WebGL2`, the probe's
    `backend` is `webgl2`, and `texturesSizeSource` is `estimated`. Remove the Task 1
    `test.fixme` from the renderer-switch case.
  - `study.no-webgl.spec.ts`: `three-glsl falls back to the CSS study once per tab`, mirroring
    the TSL case with `?renderer=three-glsl`: toast once, `data-renderer="css"`, cookie
    unchanged, a reload in the tab stays on `css`, and no `three` chunk is requested (Review
    Focus 1 of phase 2: the capability check runs before the download).
  - The throw case for GLSL uses the same init-script trick as the TSL case, applied to
    `HTMLCanvasElement.prototype.getContext` for `webgl2` only after the capability probe has
    run, so the throw lands inside `createRenderer`.

- [ ] **Step 2: Implement `kitGlsl`, the case, `canStartRenderer`**

  `StudyView` calls `canStartRenderer(renderer)` in its effect, so it re-runs when the renderer
  changes.

- [ ] **Step 3: Run**

  `pnpm nx e2e personal-calibre-e2e -- --grep "Study three"` on `chromium`, then
  `--project=no-webgl`, then `CALIBRE_WEBGPU=1 … --project=study-webgpu`. Load the dev pages
  listed in Global Constraints. Run `pnpm nx smoke-artifact personal-calibre`.

- [ ] **Step 4: Comment and MCP checks, commit**

  `feat(personal-calibre): load the GLSL study renderer behind ?renderer`.

**Verification:** unit, the three project runs above, smoke-artifact, the dev page load with no
console error (phase 2 D23 allow-list). Fixture: small seed with covers.

---

### Task 4: Renderer labels, select mismatch and debug badge

Spec: P20 (select in the Study toolbar), P23 (badge labels), Copy (Study: `three.js · WebGPU`,
`CSS`, phase 3 `three.js · GLSL` and `three-glsl · WebGL2`).

The mismatch: `RENDERER_LABELS['three-tsl']` is `three.js · WebGPU`, and the select shows it
while `three-tsl` runs on its WebGL2 backend (any browser without `navigator.gpu`, and the
headless e2e runs). The badge already says `three-tsl · WebGL2 fallback`, so the select and the
badge disagree. The fix below follows owner decision 2. The spec's Copy and P20 already carry
the new labels (updated in PR #507).

**Files:**

- Modify: `src/lib/study/renderer.ts`, `renderer.test.ts`
- Modify: `src/components/library/RendererSelect.tsx`
- Modify: `apps/personal-calibre-e2e/src/study.no-webgl.spec.ts`, `study-three.spec.ts` (select
  text)

**Interfaces:**

```ts
export const RENDERER_LABELS: Record<Renderer, string>;

export function rendererLabel(
  renderer: Renderer,
  backend: StudyBackend | null,
): string;
```

Labels (owner decision 2): `three.js · TSL`, `three.js · GLSL`, `CSS`. The select's items show these.
Its trigger shows `rendererLabel(renderer, backend)`, which appends the live backend once known:
`three.js · TSL · WebGPU`, `three.js · TSL · WebGL2`, `three.js · GLSL · WebGL2`, `CSS`. While
the backend is `null` (starting) or the session fell back to `css`, the trigger shows the plain
label of the resolved renderer. `backendLabel` (badge) is unchanged: `three-tsl · WebGPU`,
`three-tsl · WebGL2 fallback`, `three-glsl · WebGL2`, `css`.

- [ ] **Step 1: Failing unit tests** for `rendererLabel`: every renderer × `webgpu`, `webgl2`,
      `css`, `null`, and `rendererLabel('three-tsl', 'webgl2')` never contains `WebGPU`.
- [ ] **Step 2: Implement** and render the trigger text through `SelectValue`'s children (the
      item list keeps the plain labels). The trigger keeps `aria-label="Renderer"`.
- [ ] **Step 3: e2e.** In `study-three.spec.ts` on `chromium` (TSL on WebGL2): the select
      trigger contains `WebGL2` and not `WebGPU`. On `study-webgpu`: it contains `WebGPU`.
      `study.no-webgl.spec.ts`: after the fallback the trigger reads `CSS`.
- [ ] **Step 4: Comment and MCP checks, commit**
      `fix(personal-calibre): name the active backend in the Renderer select`.

**Verification:** `pnpm nx test personal-calibre -- src/lib/study/renderer.test.ts`, the select
cases on `chromium`, `no-webgl` and `study-webgpu`, axe on Study with `?debug` (the trigger text
change must keep 0 violations). Fixture: small seed.

---

### Task 5: Interaction parity e2e on GLSL

Spec: Study › Shared model and DOM accessibility layer; Pull and the Study card (pull, card,
scrub, scrub cover-out, 3D inspect, keyboard unchanged); Shared scene fixes 1 to 6; Testing ›
Playwright › Study ("and in phase 3, `three-glsl`"), axe.

Phase 2 and 2.5 shipped these behaviours with e2e on `three-tsl` (WebGL2 headless, WebGPU
headed) and `css`. This task runs the same specs on `three-glsl` without changing what they
assert. A case that passes on TSL and fails on GLSL is a kit bug, to be fixed in `kitGlsl` or
`glslMaterial`, never in shared code or the spec.

**Files:**

- Modify: `apps/personal-calibre-e2e/src/support/study.ts` (`STUDY_RUNS` gains
  `{ renderer: 'three-glsl', backend: 'webgl2' }`)
- Modify: `study.spec.ts`, `a11y.spec.ts` (they already loop `STUDY_RUNS`)
- Modify: `study-three.spec.ts`: the `scene`, `atlas`, `overlay and headings` and `covers`
  describes loop over `THREE_RUNS`
- Modify: `study.phone.spec.ts`, `study-touch.phone.spec.ts`, `study-inspect.phone.spec.ts`:
  `THREE` becomes a loop over `[tsl-webgl2, glsl-webgl2]`
- Modify: `budgets.spec.ts` (atlas timing case loops the two three.js WebGL2 runs)
- Fix, if a case fails: `kitGlsl.ts`, `glslMaterial.ts`

**Interfaces:** none new; the specs consume `THREE_RUNS` and `StudyRun` from Task 3.

Coverage this must reach on GLSL (each line names the existing case it reuses):

- Pull: `the pulled book follows focus`, `a click on a spine focuses its option`,
  `tap pulls, a second book switches directly…`, `tapping the pulled book opens its details`,
  `the pulled book covers no other book and no heading`.
- Card: `the card steps by swipe and buttons, and opens details`,
  `tapping empty space puts the book back…`, `Escape puts the pulled book back`.
- Scrub and cover-out: `long-press then slide scrubs and keeps the last book`,
  `a plain tap or the keyboard pulls without a cover-out`, `a quick swipe pans the three study…`,
  `with reduced motion a scrub shows the cover-out at once`. `data-floating-id` and the probe's
  `floatingId` must name the scrubbed book.
- Inspect: `the thumbnail opens inspect, a drag turns the book…`,
  `arrow keys turn the book; Escape closes…`, `a long press on the shelf while inspecting does
not scrub`, `the open inspect view has no axe violations`,
  `with reduced motion inspect opens in its end pose`. New for both three.js runs: programs before
  opening inspect equal programs after closing it (the dim is a uniform, #506).
- Headings: `shelf headings show labels and counts`, `headings of small groups sharing a row never
overlap`, `author headings on a shared row never overlap`.
- Keyboard and pages: the `STUDY_RUNS` cases in `study.spec.ts`.
- Reduced motion: `reduced motion has no pull and keeps a visible ring`.
- Camera: `the camera follows focus inside the clamp`, `the wheel scrolls the page at the clamp`.
- Atlas and covers: `visible rows get their atlas first…`, `page changes dispose the previous
atlases`, `the pulled book shows the fixture cover`, `the next page's covers are prefetched`,
  `the first pull after prewarm has no render spike`.
- Scheme: `scheme change recolours`.
- axe: every `STUDY_RUNS` case in `a11y.spec.ts`.

`the default page keeps 160 px per unit` stays TSL-only if GLSL picks a different rung (E7,
`targetBuffers: 0`). In that case add a GLSL case asserting the rung `pickAtlasPpu` returns for
`targetBuffers: 0`.

- [ ] **Step 1: Turn the loops on** and run each file on `chromium`, `phone` and (headed)
      `study-webgpu`.
- [ ] **Step 2: Fix kit bugs** the runs expose, with a unit case in `glslMaterial.test.ts` where
      the bug is in a material.
- [ ] **Step 3: Full run:** `pnpm nx e2e personal-calibre-e2e`, `-- --project=phone`,
      `-- --project=no-webgl`, `CALIBRE_WEBGPU=1 … --project=study-webgpu`.
- [ ] **Step 4: Comment and MCP checks, commit**
      `test(personal-calibre-e2e): run every Study interaction on the GLSL renderer`.

**Verification:** the four project runs; axe 0 violations per run. Fixture: small seed with
covers.

---

### Task 6: Visual parity and bundle separation

Spec: Testing › Playwright › Study (renderer-bundle check: "fails if … `three/webgpu` appears in
the `three-glsl` path"; visual parity ≤ 0.3% edge-only); Renderer selection and loading (GLSL
path never loads `three/webgpu`); Performance budgets (`three-glsl` extra JS, marked for re-measurement here; no three.js in any
first load).

**Files:**

- Modify: `apps/personal-calibre-e2e/src/study-parity.spec.ts`
- Modify: `apps/personal-calibre-e2e/src/study-bundle.spec.ts`
- Modify: `apps/personal-calibre-e2e/playwright.config.ts` (`chromium` stops ignoring
  `study-parity.spec.ts`; the spec skips its WebGPU pairs itself)
- Modify: `docs/superpowers/specs/2026-09-29-calibre-redesign-design.md` (the `three-glsl`
  extra JS row: the re-baselined number replaces "re-measure in phase 3 Task 6")

**Interfaces:**

```ts
type ParityPose = 'shelf' | 'pulled' | 'inspect';
interface ParityPair {
  reference: ThreeRun;
  candidate: ThreeRun;
  maxRatio: number;
  maxOffEdge: number;
}
const PARITY_PAIRS: readonly ParityPair[];
const BUNDLE_MARKERS: {
  readonly three: 'isWebGLRenderer';
  readonly webgpu: 'isWebGPURenderer';
  readonly tsl: 'isTextureNode';
  readonly glsl: 'calibre-pulled-book-glsl';
};
```

Parity (E12), each pair in light and dark, 1440×900 @2, reduced motion on, same fixture page:

- TSL WebGPU vs TSL WebGL2: phase 2's pair, kept as is (`shelf` pose).
- GLSL vs TSL WebGL2: runs on `chromium` headless (both on SwiftShader) and on `study-webgpu`
  headed (both on the GPU's WebGL2).
- GLSL vs TSL WebGPU: `study-webgpu` only.
- Poses: `shelf` (focused first option, as phase 2), `pulled` (move focus to the fifth option
  with the arrow keys and wait for `data-pulled-id`), `inspect` (open inspect from the card thumbnail,
  reduced motion gives the end pose at once, `Home` faces the front). The canvas is captured
  after `settle()`.
- Thresholds (owner decision 5): `shelf` and `pulled` `ratio ≤ 0.003` with
  `offEdge === 0`, as phase 2 D18; `inspect` `ratio ≤ 0.005` with `offEdge === 0`, because the
  enlarged book puts more Lambert-lit edge on screen. Print every ratio for the PR.

Bundle (Review Focus 1), on `next start` with `CALIBRE_BUDGETS=1`:

- `/`, `/books/1`, `/read/1`, `/?view=study&groupBy=series&renderer=css`: no script contains
  any `BUNDLE_MARKERS` value (extends the existing check with `tsl` and `glsl`).
- `/?view=study&groupBy=series&renderer=three-glsl`: after `data-backend="webgl2"`, loaded
  scripts contain `three` and `glsl` markers, and none contains `webgpu` or `tsl`. Lazy GLSL JS is
  printed as `[budget] lazy Study JS (glsl)`. Re-baseline: the spec's row reads "re-measure in
  phase 3 Task 6" (spike 253.4 KB). Take the median of three builds, set the budget to that
  number rounded up to the next 10 KB, write it into the spec and assert it here. If the median
  is over the spike's 260 KB, report it to the owner with the chunk breakdown before writing
  the new number.
- `/?view=study&groupBy=series&renderer=three-tsl`: loaded scripts contain `three`, `webgpu` and
  `tsl`, and none contains `glsl`. The 450 KB lazy budget stays.
- Step 1 of phase 2 Task 12 (react-loadable manifest) is re-checked. If the manifest now lists
  `kitGlsl` and `kitTsl` chunks, assert their file lists are disjoint apart from shared three.js
  and fiber chunks; otherwise the runtime scan stays the check.

- [ ] **Step 1: Bundle spec first** (fast to run, catches a seam leak before parity work). Build
      and serve the host artifact as in phase 2 Task 13 step 1, on the small fixture, and run
      `CALIBRE_BUDGETS=1 BASE_URL=http://127.0.0.1:3334 pnpm nx e2e personal-calibre-e2e -- --grep "Study bundle"`.
- [ ] **Step 2: Parity pairs and poses.** Run on `chromium`, then
      `CALIBRE_WEBGPU=1 … --project=study-webgpu --grep "Study parity"`.
- [ ] **Step 3: Fix** any off-edge mismatch in the GLSL kit (colour space, light term, face
      selection) with a unit case where possible; a ratio over the threshold with zero off-edge
      pixels is reported to the owner with the numbers, not hidden by a looser threshold.
- [ ] **Step 4: Comment and MCP checks, commit**
      `test(personal-calibre-e2e): GLSL parity and chunk separation checks`.

**Verification:** bundle spec against the artifact server; parity on `chromium` and
`study-webgpu`, light and dark, three poses, numbers in the PR. Fixture: small seed with covers.

---

### Task 7: Perf sweep, budgets, enable `three-glsl`, captures

Spec: Performance budgets (`three-glsl` column, desktop and phone emulation, `?__pageSize=250`
on the large fixture); Decision 3 (switchable alternative); P20 (select, cookie); Copy; visual
check before each PR.

**Files:**

- Modify: `apps/personal-calibre-e2e/perf/study-sweep.mjs` (GLSL run, mount breakdown, texture
  source)
- Modify: `src/lib/study/renderer.ts` (`ENABLED_RENDERERS = ['three-tsl', 'three-glsl', 'css']`,
  `PREVIEW_RENDERERS = []`), `renderer.test.ts`
- Modify: `apps/personal-calibre-e2e/src/study.no-webgl.spec.ts` (cookie `three-glsl` case),
  `study-three.spec.ts` (choosing GLSL in the select writes the cookie and mounts a new canvas),
  `visual.spec.ts` (`study-glsl`, `study-glsl-inspect`, phone)
- Modify: `docs/superpowers/specs/2026-09-29-calibre-redesign-design.md` (status line: phase 3
  shipped with the measured numbers; GLSL column notes)

**Interfaces:** `SweepResult` (phase 2 Task 13) gains:

```ts
interface SweepResult {
  boot: {
    canvasMountToFirstFrameMs: number;
    firstRenderCallMs: number;
    initMs: number;
    kitLoadMs: number;
    atlasFirstRowsMs: number;
    backend: string;
  };
  texturesSizeSource: 'reported' | 'estimated';
}
```

`atlasFirstRowsMs` is the time from canvas mount to the visible rows' atlases (`lastAtlasAt`
for the first batch), so the mount breakdown sums to the mount-to-first-frame number within a
few ms.

- [ ] **Step 1: Sweep.** Start the artifact server on the large fixture (phase 2 Task 13 step 1).
      Run `BASE_URL=http://127.0.0.1:3334 HEADED=1 pnpm nx perf-study personal-calibre-e2e` with
      runs `three-glsl-webgl2`, `three-tsl-webgpu`, `three-tsl-webgl2`, `css`, desktop 1440×900
      @2 and phone 390×844 @3 with CPU ×4, median of three.
      Budgets for GLSL (spec column): rAF median 16.7 / p95 ≤ 20 ms; dropped ≤ 10; long tasks 0;
      first render call ≤ 60 ms; mount → first frame ≤ 200 ms; render CPU max after prewarm
      ≤ 25 ms; program growth 0; draw calls ≤ rows + 6; lazy JS within Task 6's re-baselined budget; estimated texture
      memory ≤ 50 MiB desktop, ≤ 30 MiB phone (owner decision 4). A miss is a
      finding (E13).
- [ ] **Step 2: Enable** (E9). Update `renderer.test.ts`: `three-glsl` from the cookie resolves;
      the select lists three items. Remove any `test.fixme` that waited for two three.js
      renderers.
- [ ] **Step 3: e2e for the enabled state.** Choosing `three.js · GLSL` in the select writes
      `renderer: 'three-glsl'` to the cookie, drops `?renderer`, and mounts a new canvas with
      `data-backend="webgl2"` (E3). On `no-webgl`, a `three-glsl` cookie falls back to `css`
      with the toast and keeps the cookie.
- [ ] **Step 4: Full verification.**
      `pnpm nx run-many -t lint test typecheck -p personal-calibre personal-calibre-e2e`, the
      four e2e project runs, the bundle spec, `pnpm nx smoke-artifact personal-calibre`,
      `pnpm format:check`.
- [ ] **Step 5: Captures.** `CALIBRE_VISUAL=after` for `study-glsl` (shelf, pulled, inspect),
      light and dark, 1440 and 390, small fixture only, labelled after-only. Before/after for
      the Renderer select trigger on TSL WebGL2 (Task 4's fix). Use
      `rainforest-core:capture-evidence` and `rainforest-core:attach-pr-media`.
- [ ] **Step 6: Record and commit.** Update the spec status line with the sweep table and the
      parity ratios. Commit `feat(personal-calibre): offer the GLSL study renderer`. Hand back
      the numbers and the capture folder; the PR is opened when the user asks.

**Verification:** headed sweep on all four runs, desktop and phone; full e2e; bundle spec;
smoke-artifact; captures. Fixture: large seed (250 books) for the sweep, small seed for e2e and
captures.

---

## Known misses from phase 2

From the phase 2 sweeps (#501 and the 2.5 follow-ups; large fixture, `?__pageSize=250`, headed
M4 Pro):

- Mount to first frame: 442 to 621 ms across runs, against 300 ms (WebGPU) and 600 ms (WebGL2).
  The spec's status line records the medians, 565 and 621 ms.
- Phone render CPU max after prewarm: 32.8 ms against 25 ms.

Phase 3 does not change the TSL path beyond Task 1's refactor, so these numbers should not move.
Task 1 step 5 checks the probe numbers are unchanged, and Task 7 reports them again next to
GLSL with the mount breakdown. Owner decision 3: phase 3 does not try to close them; they go to
a separate ticket, and phase 3 only adds the mount breakdown to the sweep.

## Follow-on, out of scope

- Ray-tracing spike. A backlog note for after phase 3: an experimental renderer (for example a
  path-traced bookcase) would be a fourth `?renderer=` value behind `PREVIEW_RENDERERS`, with its
  own kit loaded by `loadKit` and the same Study DOM layer, so it needs no change to the seam this
  plan widens. Nothing in phase 3 builds toward it.
- TSL mount-time and phone render CPU work: a separate ticket (owner decision 3), fed by the
  Task 7 mount breakdown.

## Repository constraints

- Docker image from prebuilt artifacts (#468). No dependency, native module or route is added.
  `WebGLRenderer` is in `three` core, already traced as a client chunk. Tasks 3 and 7 run
  `smoke-artifact`; Task 6 runs the bundle spec against the host artifact.
- MCP and gateway (#475, `/mcp`, `mcp-kit`) untouched; every task checks the diff and keeps
  `mcp.spec.ts` green.
- Imports per CLAUDE.md `### Imports`: kits reached only by dynamic import, `views/study/three/`
  without a barrel, no `../`, `src/lib/study` three-free. E11 makes the TSL half of the seam a
  lint failure, not a review item.
- Comment allow-list in TypeScript and GLSL strings (Global Constraints).
- Fixture data only, never real names, in tests, captures and PR text.

## Self-review

- Spec coverage. `three-glsl` renderer → Tasks 2, 3. "Reworked to the same contract as the TSL
  kit" → Tasks 1, 2 (`aCol`, `aSel`, `aHi`, one pulled-book material by normal, `flat`). "Reuses
  the shared scene and every fix" → Tasks 1, 5. Select gains `three.js · GLSL` → Tasks 4, 7.
  `kitGlsl` as a second dynamic import, no `three/webgpu` on the GLSL path → Tasks 1 (lint), 3, 6. P20 `?renderer` and cookie → Tasks 3, 7; fallback to `css` → Tasks 3, 7. P23 badge and
  `data-*` → Tasks 3, 4. Decision 4 fixes on GLSL → Task 5 (focus overlay, clamp, headings,
  atlas, prewarm, reduced motion), Task 2 (uniforms, one material, `aCol`). #501 pull and card,
  #505 scrub cover-out, #506 inspect and dim uniform → Tasks 2 (back face, dim), 5 (e2e), 6
  (`pulled`, `inspect` poses). Budgets `three-glsl` column → Tasks 6 (JS), 7 (the rest). Testing
  "in phase 3, `three-glsl`" → Task 5. Bundle check "`three/webgpu` in the `three-glsl` path" →
  Task 6. Copy phase 3 strings → Task 4 (spec updated in PR #507).
- Every task names its files, its interfaces, its fixture and a runnable check.
- Types: `StudyKit<Gl>` (Task 1) is implemented by `kitTsl` (Task 1) and `kitGlsl` (Task 3);
  `StudyMaterials` is implemented by `createGlslMaterials` (Task 2); `StudyRun` and `THREE_RUNS`
  (Task 3) are consumed by Tasks 5 and 6; `rendererLabel` (Task 4) is read by `RendererSelect`;
  `SweepResult.boot.atlasFirstRowsMs` (Task 7) reads the probe's `lastAtlasAt`.

## Spec changes made with this plan (PR #507)

Gaps found while planning, fixed in `docs/superpowers/specs/2026-09-29-calibre-redesign-design.md`
in the same PR:

1. The `three-glsl` section predated #505 and #506. It now names the back face, the two
   pulled-book carriers sharing one program, and the shared `dim` uniform.
2. The GLSL texture budget was `≤ 40 MB est. (~35)`. It is now an estimate held to 50 MiB
   desktop and 30 MiB phone, the same caps as TSL (owner decision 4, E7).
3. Parity covered only the two TSL backends. The Testing section now lists the GLSL pairs, the
   three poses and their thresholds (owner decision 5, E12).
4. P20 stated the fallback chain for `three-tsl` only. It now says `three-glsl` goes straight to
   `css` (owner decision 6, E8).
5. Copy named the select items by backend. They are now named by shader path, with the live
   backend in the trigger (owner decision 2, Task 4).
6. The status line now records the 442 ms low end of mount to first frame and the 32.8 ms phone
   render CPU miss.
7. The `three-glsl` lazy JS budget (≤ 260 KB) dated from the spike, before the shared base grew
   with the scene, scrub, cover-out and inspect code. The table now marks it for re-measurement
   in Task 6. Task 6 records the measured number in the spec; a miss is reported, not absorbed.

The spec's Open questions list still holds only the phase 1 P8 item; phase 3 adds none.

## Owner decisions (PR #507)

The questions this plan raised were answered by the owner on PR #507:

1. `three-tsl`'s WebGL2 fallback stays as it is in phase 3 (decision 3 unchanged). Task 7
   measures GLSL and TSL on WebGL2 side by side, and a handover is decided later on those
   numbers.
2. Select labels follow the shader path: `three.js · TSL`, `three.js · GLSL`, `CSS`. The trigger
   shows the live backend once known (`three.js · TSL · WebGL2`). Task 4.
3. The phase 2 timing misses (mount to first frame 442 to 621 ms against 300 / 600 ms, phone
   render CPU 32.8 ms against 25 ms) go to a separate ticket. Phase 3 only adds the mount
   breakdown to the sweep (E13, Task 7).
4. The GLSL texture budget is the same as TSL's: 50 MiB desktop, 30 MiB phone, applied to the
   estimate (atlas + covers + inspect back + spine crop, `targetBuffers: 0`). E7, Task 7.
5. Parity thresholds for GLSL against both TSL backends: `ratio ≤ 0.3%` with no off-edge pixel
   for the `shelf` and `pulled` poses, `ratio ≤ 0.5%` with no off-edge pixel for `inspect`.
   E12, Task 6.
6. A `three-glsl` that cannot start goes straight to `css`, as P20 does; it never tries
   `three-tsl`. E8, Task 3.
