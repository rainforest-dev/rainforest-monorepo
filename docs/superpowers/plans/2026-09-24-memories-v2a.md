# personal-memories v2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the screens used every day match the Claude Design handoff and run smoothly on the
real data: thumbnails, day windowing, the year heatmap as month rows, messages as quote rows with
photo bursts, the restyled notes panel and phone sheet, the conflict view as version cards, plus the
known issues v1 left.

**Architecture:** Unchanged from v1: SSR `.astro` stream plus a vanilla `day-stream.ts`, one React
island (`NotePanel`), live collections for reads, Actions for writes. New: a thumbnail route backed
by `sharp` with an on-disk cache, a pure `groupRuns()` that turns a day's events into render runs,
and a pure `lineDiff()` for the conflict view.

**Tech Stack:** Astro 6.4.8, React 19, Tailwind v4 with the shared seed theme, `sharp`, Vitest,
Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-memories-redesign-design.md` (Releases → v2a) and the
visual spec `docs/superpowers/specs/2026-09-24-memories-v2-visual-spec.md` (the handoff, extracted).
Where they differ, the visual spec wins on looks and copy, and the design spec wins on behaviour.

## Global Constraints

- Everything in the v1 plan's Global Constraints still holds: semantic tokens only (no hex, raw
  palette classes or `dark:`), zh-TW UI copy, comment allow-list, sorted imports, single quotes,
  `z` from `astro/zod`, current Safari + Chrome, Asia/Taipei dates, never lose or misfile typed text.
- Copy strings come verbatim from the visual spec §4.
- Type sizes use the tokens from Task 0 (`text-meta` 13px, `text-body` 15px/1.7, `text-heading`
  17px, `text-title` 28px); `text-xs` for 12px and `text-xl` for 22px. No new `text-[Npx]`.
- The DOM contract the panel relies on is kept: `section[data-day]`, `li#ev-<id>[data-event-id]
[data-source][data-at][data-author][data-excerpt]`, `[data-annotate]`, `[data-annotated]`, and the
  `memories:day` / `memories:annotate` events.
- Private data never enters the repo: owner names come from the `MEMORIES_OWNER` env var only.
- Subagents do not commit; the controller commits per task. Touch only the files your task lists.
- Verify: `pnpm nx run-many -t lint test typecheck -p personal-memories personal-memories-e2e`,
  `pnpm nx e2e personal-memories-e2e`, plus a real-browser check on the fixture for UI tasks.

## Execution waves

| Wave | Tasks (parallel within a wave) |
| ---- | ------------------------------ |
| 0    | Task 0 (controller)            |
| 1    | Task 1, Task 2, Task 3         |
| 2    | Task 4, Task 5, Task 6, Task 7 |
| 3    | Task 8, then Task 9            |

---

### Task 0: Type-scale tokens (controller)

**Files:** `apps/personal-memories/src/styles/global.css`

- [ ] Add to the existing `@theme` block:
      `--text-meta: 0.8125rem; --text-meta--line-height: 1.4; --text-body: 0.9375rem;
--text-body--line-height: 1.7; --text-heading: 1.0625rem; --text-heading--line-height: 1.3;
--text-title: 1.75rem; --text-title--line-height: 1.2;`
- [ ] `pnpm nx build personal-memories` and confirm the four utilities exist in the built CSS.
- [ ] Commit.

### Task 1: Thumbnails

**Files:** create `src/lib/thumbs.ts`, `src/lib/thumbs.test.ts`, `src/pages/thumb/[id].ts`;
modify `package.json` (add `sharp`), `README.md` (one line on `MEMORIES_CACHE_DIR`).

**Produces:** `GET /thumb/<eventId>?n=<index>&w=<240|480|960>` → `image/webp`, `Cache-Control:
private, max-age=31536000, immutable`; 404 when the media is missing; any other `w` → 400.
`thumbPath(cacheDir, id, n, w, mtimeMs)` → a deterministic cache path; `ensureThumb(src, dest, w)`
→ writes a WebP no wider than `w` (never upscaled), atomically (tmp + rename).

- [ ] Tests first (`thumbs.test.ts`, fixture 1×1 PNG and a generated 1200×800 PNG): width is
      capped and never upscaled; a second call reuses the cached file (no rewrite, same mtime);
      a changed source mtime yields a new cache path; `w` outside the allowed set is rejected.
- [ ] Cache dir: `MEMORIES_CACHE_DIR`, default `join(os.tmpdir(), 'memories-thumbs')`, created
      on demand. The route resolves the source with the existing `mediaFile()` from `src/lib/store.ts`.
- [ ] `sharp` is a runtime dependency; confirm the Docker build still works:
      `docker build -f apps/personal-memories/Dockerfile .` completes, and a container run serves a
      thumbnail for a fixture photo.

### Task 2: Day windowing

**Files:** `src/scripts/day-stream.ts` only.

- [ ] Keep at most 7 loaded days on each side of the active day. A day beyond that is replaced by
      `<div data-day-placeholder="<date>" style="height:<measured>px">` (measured just before removal);
      when a placeholder comes within 2 viewports of the viewport, re-fetch its partial and swap it back.
- [ ] Removing or restoring content above the viewport must not move what is on screen:
      compensate `scrollY` by the height delta, as the prepend path already does.
- [ ] The active-day computation treats placeholders as days (so the URL and `memories:day` stay
      right while scrolling past them).
- [ ] Real-browser check on a fixture extended in a scratch dir to ~30 days (generate extra LINE
      lines in the scratch copy only): scroll through all of them and back; DOM never holds more than
      15 `[data-day]` sections; the viewport never jumps when a section is swapped.

### Task 3: v1 known issues

**Files:** `src/lib/notes/format.ts`, `format.test.ts`, `src/lib/notes/store.ts`, `store.test.ts`,
`src/components/notes/useStreamBridge.ts`.

- [ ] `## ` inside an annotation body: the trailing section starts only at a `## ` line that comes
      after the last `### ` block's end. A `## ` line inside an annotation body stays in that body.
      Test: an annotation whose body contains `## 小標` followed by a second annotation parses as two
      annotations with the heading in the first body, and round-trips byte-for-byte.
- [ ] Deleting a note removes its year directory when it becomes empty. Test in `store.test.ts`.
- [ ] Queued cross-day annotation onto a read-only day (malformed YAML): in `useStreamBridge`, the
      effect that applies a queued anchor checks `readOnly` and drops the anchor instead of editing.

### Task 4: Year heatmap

**Files:** rewrite `src/components/Heatmap.astro`; modify `src/pages/index.astro`,
`src/lib/days.ts` (+ tests).

- [ ] Replace `calendarWeeks` with `monthRows(first, last, totals)`: one row per calendar month,
      31 slots, `null` for dates the month doesn't have or outside the range. Tests: a range across a
      year boundary, February in a leap year, a range starting mid-month.
- [ ] Four heat levels at `bg-primary/20 /40 /65 /90` plus `bg-muted` for 0 (update `heatLevels`
      to return 0–4 on the same quartile rule; existing tests adjusted).
- [ ] Layout per visual spec §3 "Year heatmap": 56 px month label, 24 px cells, 6 px gap, the year
      number printed only before a year's first month (fixes the v1 label overlap), legend top-right,
      noted-day 6 px dot (`bg-foreground`, `bg-primary-foreground` on the two strongest levels), tooltip
      on hover and focus above the cell (CSS only, `:hover`/`:focus-visible`, no JS), footer hint.
- [ ] Cells with events stay `<a data-date href="/day/<date>">` (e2e selector). Phone (< 640 px):
      the whole month row is one link to the first day with events in that month; 8 px day bars.
- [ ] Zero client JS stays true. Real-browser check light/dark at 1440 and 390.

### Task 5: Day stream as quote rows

**Files:** create `src/lib/stream.ts`, `src/lib/stream.test.ts`; rewrite
`src/components/DaySection.astro`; modify `src/pages/day/[date].astro` (sticky heading only),
`src/styles/global.css` (only the selectors DaySection needs).

**Produces:** `groupRuns(events, owners: Set<string>)` → runs of `{ kind: 'text', author, source,
isOwner, events }` (same author and source, consecutive) or `{ kind: 'photos', events }`
(consecutive photos). `ownersFromEnv()` reads `MEMORIES_OWNER` (comma-separated names).

- [ ] Tests first for `groupRuns`: author change splits a run; a source change splits a run; a photo
      between messages makes its own run; a photo run is one run; time is shown on the first event of a
      run only (expose `showTime` per event).
- [ ] Row layout per visual spec §3 "Day stream": `grid-cols-[52px_1fr_20px]` (42 px on phone), no
      card background, head row with author + source only at a run start, owner rows `pl-12`/`pl-7`,
      `text-body`, time `text-xs tabular-nums`. Annotated marker = 6 px `bg-primary` dot in the right
      gutter via `[data-annotated]` CSS. Linked message = `bg-primary/15 ring-1 ring-inset
ring-primary/45` via `:target`.
- [ ] Photo runs: 4-column grid of square `rounded-sm` tiles using `/thumb/<id>?w=480`
      (`srcset` 240/480/960), `loading="lazy"`, width/height from the event; runs longer than 4 show 3
      tiles and a 4th tile with a `+N` scrim. Each tile links to the full `/media/<id>` (the v2b
      lightbox replaces this link later).
- [ ] 眉批 action: desktop hover/focus pill per spec (`bg-popover`), still `[data-annotate]`. Phone:
      keep a visible 眉批 button on tap (long-press menu is v2b).
- [ ] Sticky day heading: `text-heading` + `N 則`. The busiest-day hour strip is included when the
      day has ≥ 100 events (24 bars, height ∝ events that hour, ruler 00/06/12/18/24).
- [ ] The DOM contract is unchanged; e2e must still pass.

### Task 6: Notes panel and phone sheet

**Files:** `src/components/NotePanel.tsx`, `src/components/notes/AnnotationItem.tsx`, new
`src/components/notes/BottomSheet.tsx` (only if NotePanel would exceed ~150 lines).

- [ ] Surface `bg-sidebar border-sidebar-border`, desktop column 400 px. Header per spec: 這一天的回憶
  - date + status chip (已儲存 with check, 儲存中… pulsing dot, 未儲存 `bg-warning` dot). The v1
    labels 有衝突/載入失敗 stay but render in the same chip style.
- [ ] Textarea `min-h-[232px]`, `text-body`, placeholder 這一天想起了什麼？, footer
      `Markdown · 自動儲存`. Annotation cards and the dashed unattached card per spec, copy verbatim.
      Zero-annotation copy per spec.
- [ ] Read-only: user-facing notice per spec (lock icon, 唯讀。尚未設定儲存位置，回憶和眉批暫時無法寫入。);
      the textarea is hidden and the existing memory renders as text. Keep the malformed-YAML notice from
      v1 in the same style.
- [ ] Phone: a two-state sheet — peek 156 px (title, status, 眉批 N, 2-line clamp of the memory) and
      full (`top-[88px]`); tapping the peek opens full, a drag handle / close returns to peek. Keep the
      existing aria labels (`筆記`, `當天的回憶`, `眉批：<excerpt>`).
- [ ] Hydration lock, flush-before-switch and conflict handling from v1 are untouched.

### Task 7: Conflict view as version cards

**Files:** create `src/lib/diff.ts`, `src/lib/diff.test.ts`; rewrite
`src/components/notes/ConflictView.tsx` (same props).

- [ ] `lineDiff(a: string, b: string)` → `{ a: { text, changed }[], b: { text, changed }[] }` by
      LCS over lines. Tests: identical, one line changed, lines added/removed, empty sides.
- [ ] Layout per spec: `bg-info/10` block, headline 這一天在 Obsidian 裡也改過了, sub-line, then two
      cards (「Obsidian 的版本」 and 「這個畫面的版本」) with changed lines on `bg-info/15`, each with a
      保留這個版本 button. Button wiring maps to the existing keep-theirs / keep-mine handlers; the e2e
      selector changes accordingly in Task 9.

### Task 8: Owner and cache config in the homelab (controller, other repo)

- [ ] `rainforest-homelab`: module env `MEMORIES_OWNER=${var.owner_names}` (value from
      `terraform.tfvars`, which is gitignored) and `MEMORIES_CACHE_DIR` pointing inside the container
      (tmpfs is fine; thumbnails regenerate). PR, plan, apply after the monorepo PR merges.

### Task 9: E2E, README, PR

**Files:** `apps/personal-memories-e2e/src/timeline.spec.ts`, `apps/personal-memories-e2e/playwright.config.ts`
(set `MEMORIES_OWNER` to a fixture author, e.g. `Bob`), `apps/personal-memories/README.md`.

- [ ] Update selectors for the new heatmap, conflict buttons (保留這個版本 on the Obsidian card),
      and quote rows; add: a thumbnail request returns `image/webp`; the owner's rows are indented; a
      photo run longer than 4 shows `+N` (extend the fixture in `src/lib/ingest/__fixtures__` with
      synthetic photos only).
- [ ] README: `MEMORIES_OWNER`, `MEMORIES_CACHE_DIR`, `/thumb`.
- [ ] Full verification, then PR with before/after captures from the fixture (create-pr skill).
