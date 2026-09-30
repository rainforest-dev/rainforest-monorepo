# Memories v2 — implementation design spec

Source: `Memories.dc.html` (screens 1–4 + hand-off notes §6) + `NotesPanel.dc.html` (panel states),
read against the brief (`docs/superpowers/specs/2026-09-23-memories-claude-design-brief.md`) and
the shipped token plugin (`libs/rainforest-ui/src/tailwindcss/shadcn.ts`). All classes below are
Tailwind utilities backed by that plugin; `personal-memories/src/styles/global.css` only loads the
plugin's colors + one `--radius`, **not** the design-system's `typography.css`/`spacing.css` mirror
— see §5 for the type-scale gap that causes.

## 1. Token mapping

| Design value                                         | Tailwind utility                                                                                 | Notes                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `var(--background)`/`var(--foreground)`              | `bg-background` / `text-foreground`                                                              | direct                                                                           |
| `var(--card)`/`var(--card-foreground)`               | `bg-card` / `text-card-foreground`                                                               | annotation cards, filled month cells                                             |
| `var(--popover)`/`var(--popover-foreground)`         | `bg-popover` / `text-popover-foreground`                                                         | tooltip, 眉批 hover pill, long-press menu                                        |
| `var(--muted)`/`var(--muted-foreground)`             | `bg-muted` / `text-muted-foreground`                                                             | tab rail, meta text, empty month-cell text                                       |
| `var(--border)` / `var(--input)`                     | `border-border` / `border-input`                                                                 | dividers, search box, dashed unattached card                                     |
| `var(--primary)` 20/40/65/90%                        | `bg-primary/20 /40 /65 /90`                                                                      | heatmap 4-level scale (brief: one token, opacity only)                           |
| `var(--primary)` 10%                                 | `bg-primary/10`                                                                                  | selected message row + selected annotation card                                  |
| `var(--primary)` 14–15% + ring 45%                   | `bg-primary/15 ring-1 ring-inset ring-primary/45`                                                | linked/highlighted message                                                       |
| `var(--accent)`/`-foreground`                        | `bg-accent/60` (hover), `bg-accent` (long-press), `bg-accent text-accent-foreground` (眉批 pill) | message hover + action affordance                                                |
| `var(--ring)`                                        | `ring-ring`, focus: `ring-2 ring-ring ring-offset-2 ring-offset-background`                      | day cell / message / annotation focus                                            |
| `var(--sidebar)`/`-border`                           | `bg-sidebar` / `border-sidebar-border`                                                           | notes column + bottom sheet — app currently uses `bg-card` here, see §5          |
| `var(--warning)`                                     | `bg-warning` (6px dot)                                                                           | 未儲存 status                                                                    |
| `var(--info)` 9–16%                                  | `bg-info/10` (banner), `bg-info/15` (diff line)                                                  | conflict panel                                                                   |
| `var(--foreground)` / `var(--primary-foreground)`    | `bg-foreground` / `bg-primary-foreground`                                                        | 已寫回憶 dot; flips to `-foreground` on the two darkest heat levels for contrast |
| `chart-1..5` mixed 50% w/ muted                      | —                                                                                                | design-doc stand-ins for real photos only; ship real `<img>`, no token needed    |
| `var(--radius)` = 0.625rem                           | `rounded-lg`                                                                                     | tab pill (active), message row, annotation card, day cell                        |
| `calc(var(--radius) - 4px)` = 6px                    | `rounded-sm`                                                                                     | photo tiles, small heat-cell corners                                             |
| `calc(var(--radius) - 2px)` = 8px                    | `rounded-md`                                                                                     | tooltip/popover corners                                                          |
| `calc(var(--radius) + 4px)` = 14px                   | `rounded-xl`                                                                                     | only the mock's own screen frame, not app UI                                     |
| `calc(var(--radius) - 6px)` ≈ 4px (kbd, tiny dots)   | **no exact utility** — closest is default `rounded` (4px); flag                                  | used for `<kbd>` hint chips, diff-line rounding                                  |
| 999px                                                | `rounded-full`                                                                                   | 年/月/日 tab pills, avatars, marker dots                                         |
| 12px                                                 | `text-xs`                                                                                        | exact match — time, source, counts, tabular-nums                                 |
| 13px                                                 | **no exact match** (`text-sm`=14px) — use `text-[13px]`                                          | labels, author names, panel headings                                             |
| 15px / leading 1.7                                   | **no exact match** (`text-base`=16px) — use `text-[15px] leading-[1.7]`                          | messages, memory textarea                                                        |
| 17px semibold                                        | **no exact match** (`text-lg`=18px) — use `text-[17px]`                                          | sticky day heading                                                               |
| 22px                                                 | `text-xl` (1.375rem = 22px)                                                                      | exact match — phone page titles                                                  |
| 28px                                                 | **no exact match** (`text-2xl`=24, `text-3xl`=30) — use `text-[28px]`                            | desktop page titles                                                              |
| weights 400/500/600                                  | `font-normal` / `font-medium` / `font-semibold`                                                  | no 700 anywhere in the design                                                    |
| tracking −0.01em (≥17px)                             | `tracking-[-0.01em]`                                                                             | Tailwind's `tracking-tight` is −0.025em, not this                                |
| spacing 4/8/12/16/20/24/32/48/64px                   | `p/gap/m-1…16`                                                                                   | all on Tailwind's default 4px-grid steps, no gaps                                |
| motion 300ms `cubic-bezier(.2,0,0,1)`, 150ms reduced | `duration-300 ease-[cubic-bezier(0.2,0,0,1)]`, `motion-reduce:duration-150`                      | drives `view-transition-name`, not a plain CSS transition                        |

## 2. Global

- **Shell top bar** (h-14/56px, `border-b border-border`): wordmark "回憶" → 年/月/日 pill group
  (`bg-muted` rail, active `bg-background shadow-xs text-foreground`, inactive `text-muted-foreground`)
  → flex spacer → date-jump box (`w-[220px] h-[34px] border border-input rounded-lg`, search icon +
  "跳至日期" + `<kbd>/</kbd>`). Day view adds prev/next ghost icon buttons (40×40) with `j`/`k` kbd
  hints between the tabs and the search box.
- **Widths**: desktop frame 1440×900; year content column 1000px centered; month grid full-bleed
  inside 64px side padding; day view splits into a 56px month-scrubber rail + `max-w-[660px]`
  centered stream + a 400px (`w-[400px]`) notes column. Phone frame 390×844; notes become a bottom
  sheet, not a column.
- **Type/spacing/radius**: see §1 table.
- **Focus ring**: `ring-2 ring-ring ring-offset-2 ring-offset-background` everywhere keyboard-reachable
  (day cells, message rows, annotation cards); the memory textarea instead uses a soft
  `ring-3 ring-ring/35` with no offset, since it already has its own border.
- **Motion**: pure CSS view transitions, no animation library. Year cell → month cell → day heading
  share one `view-transition-name: day-<date>` so the same element morphs across zoom levels; 300ms
  standard ease, collapsing to a 150ms cross-fade under `prefers-reduced-motion`. Sticky day headings
  - an `IntersectionObserver` drive the scrubber and top-bar date as the stream scrolls.

## 3. Per-screen

**Year heatmap** — one row per month (`56px label + 31×24px cells`, 6px gap, cell `rounded-sm`,
row height 30px); a year number (13px semibold) precedes only the first month of that year, so year
and month labels never collide — no per-month year repetition. Legend: `少 [5 swatches @ 0/20/40/65/90%] 多`

- 已寫回憶 dot, top-right. Noted-day marker: 6px dot, `bg-foreground` normally, `bg-primary-foreground`
  on the two strongest heat levels for contrast. Tooltip on hover/focus floats **above** the cell
  (`bottom: 36px`), `bg-popover`, shows date + "N 則 · 已寫回憶". Footer keyboard hint: `←/→ 在日子間移動`,
  `Enter 打開那一天`; cells are focusable (should render as `<a href="/day/...">`, see §5). Phone: bars
  compress to 8px-wide/day, 28px month gutter; **whole month row** is the tap target (day cells too
  small individually) — copy: "點一列，打開那個月。"

**Month calendar** — desktop: 7-col grid, 8px gap, 104px row cells. Content precedence inside a
cell: cover photo (flex-1 rounded block) → memory first line (3-line clamp) → message excerpt
in `「quote marks」` (3-line clamp, muted). Empty day keeps the cell with just the day number,
`ring-1 ring-inset ring-border` — never hidden. Phone: list rows, not a grid —
`grid-cols-[40px_52px_1fr_auto]`, row 64px (has events) / 40px (none), thumb only when a cover exists.

**Day stream** — sticky heading = date (17px semibold) + "N 則"; the busiest-day variant adds a
24px hour-bucket bar strip (00/06/12/18/24 ruled) inside the same sticky block. Messages are quote
rows, not bubbles: `grid-cols-[52px_1fr_20px]` (42px gutter on phone), no background by default.
Author + source render only in a separate head row on speaker/source change, not per-message.
Shipped default is the **indent** speaker style: owner's messages get `pl-12` desktop / `pl-7`
phone, both left-aligned (the design also has an unused `align` prop that right-aligns the owner
into an 84%-wide bubble — decided 2026-09-24: indent ships, align is not built). Time prints once per run
(blank on repeats). Photo bursts: 4-col grid of square `rounded-sm` tiles; runs over 4 show 3 real
tiles + a 4th `+N` scrim tile. 眉批 action: desktop hover pill (`right-24 -top-16`, `bg-popover`)
on hover/focus; phone 450ms long-press opens a `bg-popover` menu with 眉批 + 複製 rows (40px each).
Annotated marker: 6px `bg-primary` dot in the trailing gutter. Highlighted/linked message:
`bg-primary/14 ring-1 ring-inset ring-primary/45`, plus a 4s dismissible pill above the stream:
`從連結開啟 · 已移到 14:32 的訊息`. Selected message↔annotation pair share `bg-primary/10` on both
sides — no drawn connector, just matching color. Month scrubber: 56px rail, 36px rows, 4px dot +
label, current month bold + `bg-primary` dot, year breaks inline (10px) above their first month.
Phone sheet: peek 156px ("這一天的回憶" + 已儲存 + "眉批 N" + 2-line clamp) or full (`top-[88px]`,
embeds `NotesPanel` in `compact` padding); a 3px scroll-position rail sits at the screen edge,
separate from the sheet's own drag handle. Row shape: `grid-cols-[52px_1fr_20px]` — time gutter,
text (`pl-12` when the owner), trailing marker dot.

**Notes panel** (desktop 400px, `bg-sidebar border-sidebar-border` — not `bg-card`, see §5) —
header: "這一天的回憶" (13px semibold) + date (12px muted) + right-aligned status chip: 已儲存
(check icon), 儲存中…(pulsing 6px dot), 未儲存 (6px `bg-warning` dot); no separate "有衝突" chip,
conflict just shows 未儲存. Textarea: full width, `min-h-[232px]`–`[260px]` (180px compact),
15px/1.75, placeholder `這一天想起了什麼？`, footer `Markdown · 自動儲存` + optional `n` hint.
Annotation list: header "眉批" + count, 28px above. Each card: `bg-card ring-1 ring-border`
(`bg-primary/9 ring-primary/40` when selected), meta `HH:MM · 來源 · 作者` (12px muted), excerpt
with a 2px `border-l border-border` rule, owner's note (14px/1.65). Unattached annotation: dashed
card pinned above the list — `找不到原本的訊息 · 原為 HH:MM · 來源 · 作者` + excerpt + `重新連結`
(secondary, sm) + helper `再點選串流裡的一則訊息`. Conflict replaces the textarea entirely
(`bg-info/9` block): headline `這一天在 Obsidian 裡也改過了`, sub
`兩個版本都在下面，不同的地方已標出。選一個保留。`, then one card per version (labelled by
who/when, so possibly >2 versions) with per-line `bg-info/16` diff highlighting and its own
`保留這個版本` button. Read-only: muted banner + lock icon +
`唯讀。尚未設定儲存位置，回憶和眉批暫時無法寫入。`, textarea is **hidden** (not disabled), the
existing memory still renders read-only below it. Empty state: same textarea, empty + placeholder,
no illustration; zero-annotation copy: `還沒有眉批。把游標移到訊息上，按「眉批」就能加一則。`

**Lightbox** — desktop: 64px bar (timestamp + `照片 · i/N`, spacer, 設為封面/已設為封面 Button,
close), photo fixed 640px height / 3:2 in a `grid-cols-[96px_1fr_96px]` with prev/next Buttons on
either side, 104px filmstrip footer (56px thumbs, active thumb gets the focus-ring treatment at
full opacity, others 70%). 設為封面 is a two-state Button (outline → secondary + check icon), no
confirmation step. Phone: photo 2:3 up to 560px tall, 44px thumbs, full-width 44px cover button.

## 4. zh-TW copy (verbatim)

Nav/shell: `回憶` · `年` `月` `日` · `跳至日期` · `上個月`/`下個月` (aria) · `前一天`/`後一天` (aria)
· `在日子間移動` · `打開那一天` · `點一列，打開那個月。`

Year: `少` / `多` · `已寫回憶` · `2024 年 6 月 – 2025 年 11 月` · e.g. `21 則 · 已寫回憶`

Month: day count badge, memory excerpt in `「…」` quotes, no other chrome text.

Day stream: `眉批` (action + marker) · `複製` (long-press menu) · `照片` (photo-run author slot) ·
`從連結開啟 · 已移到 14:32 的訊息` · `這一天的回憶` (sheet peek title) · hour ruler `00 06 12 18 24`.

Notes panel: `這一天的回憶` · `已儲存` / `儲存中…` / `未儲存` · `這一天想起了什麼？` (placeholder) ·
`Markdown · 自動儲存` · `眉批` + count · `找不到原本的訊息 · 原為 10:41 · LINE · 佳穎` ·
`重新連結` · `再點選串流裡的一則訊息` · `這一天在 Obsidian 裡也改過了` ·
`兩個版本都在下面，不同的地方已標出。選一個保留。` · `保留這個版本` ·
`唯讀。尚未設定儲存位置，回憶和眉批暫時無法寫入。` ·
`還沒有眉批。把游標移到訊息上，按「眉批」就能加一則。`

Lightbox: `照片 · 3 / 5` · `設為封面` · `已設為封面` · `上一張` / `下一張` (aria) · `關閉` (aria).

## 5. Contradictions / gaps vs the brief and the current app

1. **No 年/月 screens exist.** The app only has `/` (a week-column heatmap), `/week/[isoWeek]`,
   `/day/[date]`, `/media/[id]`. The whole 年/月/日 tab shell, date-jump box, prev/next-day nav and
   month scrubber are new UI, not restyles.
2. **Current home heatmap ≠ design's year heatmap.** `Heatmap.astro` is GitHub-style (53 week
   columns × 7 day rows, 3-opacity scale `bg-primary/25 /50 /75` + solid). The design is
   month-row-based (12 rows × up to 31 days) with a 4-opacity scale (20/40/65/90%). Different
   layout and different level count — not a drop-in class swap.
3. **Messages render as bubbles today**, exactly what the brief says to avoid:
   `DaySection.astro` wraps every event in `bg-card border rounded-lg p-3`, prints the author on
   every message, and has no speaker indent/alignment or run-consolidated head row.
4. **No burst grid, no lightbox.** Every photo is its own full-width `<img>`; there's no `+N`
   collapsing and no lightbox route/component of any kind — screen 4 has zero equivalent today.
   There's also no "cover photo" concept in the content model, so the month cell's cover-photo
   precedence and the 設為封面 action both need new data, not just new UI.
5. **Notes panel surface differs**: today it's `bg-card`, `fixed`+collapsible on mobile /
   `sticky` 380px on desktop, no peek-vs-full bottom sheet. The design specifies `bg-sidebar` and
   an explicit two-state sheet. Read-only copy today is developer-facing
   (`未設定可寫入的 MEMORIES_NOTES_DIR`) vs. the design's user-facing sentence.
6. **Conflict UI pattern changed**, not just restyled. `ConflictView.tsx` is a fixed two-column
   "Obsidian 的版本 / 目前的版本" layout with two big resolve buttons and no diff highlighting. The
   design shows N stacked, author/time-labelled version cards with line-level diff highlighting and
   one `保留這個版本` button per card — this changes both the data shape (labelled by who, not a
   fixed pair) and the interaction.
7. **Keyboard shortcuts unimplemented**: `j`/`k`/`n`/`/` and the month scrubber, date-jump box, and
   day-header prev/next controls don't exist anywhere in the current code.
8. **Speaker style is ambiguous in the handoff itself**: it ships an unused `align` (right-bubble)
   variant behind a prop alongside the shipped `indent` default across every populated mock —
   confirm "indent" is final before building both.
9. **Type scale isn't wired in.** `personal-memories/src/styles/global.css` only imports the
   shadcn color/radius plugin, not the design-system's `typography.css`. Several exact sizes in the
   handoff (13/15/17/28px) fall off Tailwind's default scale and need arbitrary `text-[Npx]` values
   or a small `@theme` addition — worth deciding once rather than ad hoc per component.
10. **Noted-day marker logic differs**: the design's dot flips to `--primary-foreground` on the two
    darkest heat levels for contrast; today's `Heatmap.astro` instead draws a `ring-foreground`
    outline around noted cells. Same intent, different visual mechanism — pick one.
