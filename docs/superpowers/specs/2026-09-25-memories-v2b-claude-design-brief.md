# Memories v2b: Claude Design brief on the synced design system

Date: 2026-09-25. Status: draft, waiting on `/design-sync` for `libs/rainforest-react`.

This brief replaces [the 2026-09-23 brief](2026-09-23-memories-claude-design-brief.md) for all
remaining visual work. That brief was drawn on the hand-authored "rainforest.tools Design System";
this one targets the same Claude Design project (`b6041f7f-6f56-4c79-bb21-a8f8555108ea`) after it
is re-synced from real components. Engineering decisions stay in the
[redesign spec](2026-09-23-memories-redesign-design.md); the v2a values already shipped are in the
[visual spec](2026-09-24-memories-v2-visual-spec.md).

## Purpose and audience

A private album for two readers, the owner and one invited viewer who signs in with Google and
has the same view and write access as the owner today. It merges LINE, Slack DMs and Photos into one
timeline and lets the owner write what each day brings back. The tone is a quiet diary. Writing
matters as much as browsing.

Claude Design gets fixture data only. The repo is public and anything uploaded goes to Anthropic,
so never paste real photos, messages, names or dates from the album. Use the e2e fixture authors
(Alice, Bob), invented messages, and flat `chart-1..5` blocks as photo stand-ins.

## What the synced system provides

Exports from `@rainforest-dev/rainforest-react` that this design may use:

- `Button` (`default`, `outline`, `secondary`, `ghost`, `destructive`, `warning`, `link`; sizes
  `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`), `buttonVariants`
- `Badge` (`default`, `secondary`, `destructive`, `success`, `warning`, `info`, `muted`,
  `outline`, `ghost`, `link`), `badgeVariants`
- `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction` (`default`, `destructive`, `success`,
  `warning`, `info`)
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`,
  `CardFooter` (size `sm`)
- `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`,
  `DialogDescription`, `DialogFooter`, `DialogClose`
- `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`,
  `CommandItem`, `CommandSeparator`, `CommandShortcut`
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`,
  `DropdownMenuShortcut`
- `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverHeader`, `PopoverTitle`
- `Tabs`, `TabsList` (`default`, `line`), `TabsTrigger`, `TabsContent`
- `Textarea`, `Input`, `InputGroup`, `InputGroupAddon`, `InputGroupInput`, `InputGroupText`
- `Switch`, `Toaster` with `toast` (the `Table` and `Select` families are not needed here)

Rules from `libs/rainforest-react/conventions.md` that bind the design:

- Colour from semantic tokens only; no hex, raw palette or `dark:`. Schemes switch through
  `data-scheme` on `<html>`, because overlays portal to `<body>`.
- The shipped stylesheet has token opacity steps `/10 /15 /20 /50 /80 /90` only. v2a uses
  `/40 /65 /35 /45`; the design should move to shipped steps (heat scale `/20 /50 /80 /90`) or
  name each extra step so the lib's safelist grows before re-sync.
- Sizes come from the shipped scale. Arbitrary values (`w-[400px]`, `text-[15px]`) do not render
  in the canvas. Use `w-96` for the notes column and `max-w-2xl` for the stream.
- Inter only; lucide icons at `size-4`; controls `h-8`.

The page shells (heatmap, month grid, stream, scrubber) are app layout, not library components.
They are drawn with tokens and layout utilities, and server-rendered Astro reuses the recipes
through `@rainforest-dev/rainforest-ui/recipes`.

## Screens

Every screen at desktop 1280 x 800 and phone 390 x 844, light and dark. Common states for each:
empty, loading, error, and large volume (about 14k events over 18 months; days with several hundred
messages; photo bursts of several hundred).

### v2b, new

1. Month calendar (`/month/YYYY-MM`). Desktop 7-column grid; phone list rows. Cell precedence:
   cover, then first memory line, then a quoted message excerpt. Days without events stay visible
   with only the number. Components: `Badge variant="muted"` for counts, `Button variant="ghost"
size="icon"` for previous and next month, `Tabs` for the 年/月/日 switch. Tokens: `card`,
   `muted`, `border`, `ring`, noted-day dot in `foreground`. States: a month with no events, a
   month with no photos at all, covers loading (skeleton blocks in `muted`).
2. Lightbox. `Dialog` with `DialogContent`, `DialogTitle` (timestamp), `DialogClose`; previous
   and next as `Button variant="outline" size="icon-lg"`; 設為封面 as a two-state `Button`
   (`outline`, then `secondary` with a check icon). Filmstrip for bursts of hundreds must
   scroll and keep the active thumb in view with a `ring` outline. States: image loading, failed
   image, a video item, the current cover.
3. Zoom transitions, year to month to day. Draw the start and end frame of each step and mark the
   element that morphs (heat cell, month cell, day heading).
4. Month scrubber. A thin rail beside the stream; current month in `primary`. Show it with 18
   months and with years crossing.
5. Date jump. `CommandDialog` with `CommandInput`; days grouped by month in `CommandGroup`, the
   count as `CommandShortcut`. States: partial date, no match (jumps to the nearest day). The
   top-bar trigger is an `InputGroup` with a `/` hint.
6. Keyboard shortcuts overlay. `Dialog` listing shortcuts grouped by screen, opened with `?`.

### v2a, restyle on synced components

7. Year heatmap (home). Keep month rows. Tooltip is currently a hand-built popover; draw it with
   `Popover` styling. States: first-run `Alert` in place of the current `EmptyState` card, and a
   range of one month.
8. Day stream. Quote rows, owner indented, head row only on speaker change, photo bursts as a
   4-tile grid with a `+N` tile. The 眉批 hover action becomes `Button size="xs" variant="outline"`
   on a `popover` surface; the phone long-press menu is `DropdownMenu` with 眉批 and 複製. Source
   filter (LINE, Slack, 照片) as `Switch` or toggle chips. States: busiest day with the hour
   strip, burst expanded after `:target`, highlighted message from a link, partial load failed.
9. Notes panel. `bg-sidebar`; `Textarea` for the memory; save status as `Badge variant="muted"`
   (已儲存), `muted` with a pulsing dot (儲存中…), `warning` (未儲存); annotations as
   `Card size="sm"`, selected card at `bg-primary/10`; unattached annotation as a dashed `Card`
   with `Button variant="secondary" size="sm"` 重新連結; read-only and parse error as
   `Alert variant="warning"`; 刪除 as `Button variant="ghost" size="xs"`.
10. Phone bottom sheet. Peek (title, status, 眉批 count, two-line clamp) and open states, drag
    handle, sheet over the stream.
11. Conflict view. Two version `Card`s, stacked on phone and side by side on desktop, changed lines
    at `bg-info/15`, one `保留這個版本` `Button` each, the banner as `Alert variant="info"`.

## Copy

Keep these exactly as the app ships them: 回憶, 少, 多, 已寫回憶, N 則, N 則 · 已寫回憶,
點一列，打開那個月。, 打開那一天, ← 全部日子, 找不到 {date} 這一天。, 還沒有時間軸, 照片, N 張, 眉批,
來源, 這一天的回憶, 已儲存, 儲存中…, 未儲存, 有衝突, 載入失敗，捲動時會再試, 這一天想起了什麼？,
Markdown · 自動儲存, 唯讀。尚未設定儲存位置，回憶和眉批暫時無法寫入。,
這一天的筆記檔格式有誤，請在 Obsidian 修正後重新整理。, 收合筆記, 展開筆記, 刪除,
找不到原本的訊息 · 原為 {HH:MM · 來源 · 作者}, 重新連結, 再點選串流裡的一則訊息,
還沒有眉批。把游標移到訊息上，按「眉批」就能加一則。, 這一天在 Obsidian 裡也改過了,
兩個版本都在下面，不同的地方已標出。選一個保留。, Obsidian 的版本, 這個畫面的版本, 保留這個版本,
（空白）, N 則眉批.

Drawn in the earlier handoff, not shipped yet: 年, 月, 日, 跳至日期, 前一天, 後一天, 上個月, 下個月,
在日子間移動, 設為封面, 已設為封面, 照片 · i / N, 上一張, 下一張, 關閉, 複製,
從連結開啟 · 已移到 {HH:MM} 的訊息.

New, proposed for the owner to confirm: 鍵盤快速鍵 (overlay title), 這個月沒有紀錄,
沒有這一天，已跳到最近的 {date}, 載入中…, 圖片載入失敗, 目前的封面, 按 ? 看所有快速鍵.

## Interaction and motion

- Zoom uses cross-document view transitions. One `view-transition-name` per day ties the heat
  cell, month cell and day heading. 300 ms, `cubic-bezier(0.2, 0, 0, 1)`. Under
  `prefers-reduced-motion` it becomes a 150 ms cross-fade, and the pulsing save dot stops.
- Phone gestures: swipe left or right in the lightbox, drag the sheet handle between peek and
  open, long-press (450 ms) a message for the menu, and pinch-out on the day stream to zoom to
  the month. Every gesture has a visible button equivalent.
- Keys: `j`/`k` previous or next day, `n` focus the memory, `/` date jump, `?` shortcuts, arrow
  keys across heatmap cells and lightbox photos, `Enter` opens, `Esc` closes the top overlay.
  Keys are ignored while typing in a field.
- Focus: opening the lightbox, date jump or overlay traps focus and returns it to the trigger;
  a zoom lands focus on the day heading or month cell that morphed; the sheet moves focus to its
  handle when opened and back to the peek when closed. Focus rings use `ring`.

## Component gaps

The library lacks these. Each is added to `libs/rainforest-react` with a story, re-synced, and only
then used in the design:

- `Sheet` or `Drawer` for the phone notes sheet (a bottom side with a peek height).
- `Tooltip` for heatmap cells and icon buttons.
- `Kbd` for shortcut hints and the overlay.
- `Skeleton` for loading covers, thumbs and partial days.
- `ToggleGroup` or `Checkbox` for the source filter.
- `Separator` for panel and menu dividers.
- `ScrollArea`, if the lightbox filmstrip and scrubber need styled scrollbars.
- Type-scale tokens: v2a's `text-meta`, `text-body`, `text-heading`, `text-title` (13, 15, 17 and
  28 px) are app-local. Either move them into the lib theme or map them to `text-sm`, `text-base`,
  `text-lg`, `text-3xl`.

Until then the design draws a labelled placeholder, not a hand-rolled lookalike.

## Handoff contract

The implementation needs from the handoff:

- Artboards named `screen / state / viewport / scheme`, for example `day / busiest / 390 / dark`,
  one per state listed above.
- Every component referred to by its exact export name in the chat and in the notes, with variant
  and size.
- Decisions recorded in the chat, one line each, including which side-by-side option was chosen
  and why. Unresolved choices stay as comments.
- Any token opacity step, size or component outside the shipped set listed explicitly.

After implementation:

- Playwright captures of the running app on the fixture data dir at 1280 and 390, both schemes,
  next to the matching artboard's `screenshot`. Differences go into the PR or a design comment.
- Accepted screens become `toHaveScreenshot` baselines in `apps/personal-memories-e2e`, which has
  none today.
- Tokens only: no hex, raw palette classes or `dark:` in `apps/personal-memories/src`, checked the
  way `libs/rainforest-react/src/contract.test.ts` checks the library.
- Every design comment ends resolved or cited in the PR.

## Open questions for the owner

- Heat scale: accept `/20 /50 /80 /90`, or safelist `/40 /65`?
- Lightbox: the React `Dialog` as a second island, or native `<dialog>` styled with the same
  classes, as the redesign spec planned?
- Type scale: lib tokens or the default Tailwind steps?
- Should the invited viewer's view stay identical to the owner's, or become read-only without the
  notes panel?
- Zoom out by key: `Esc` from day to month to year, or a dedicated key?

## First prompt for Claude Design

```text
Use the synced "rainforest.tools Design System" for everything. Build from its components by
export name (Button, Badge, Alert, Card, Dialog, CommandDialog, DropdownMenu, Popover, Tabs,
Textarea, InputGroup, Switch). Use semantic tokens only, shipped opacity steps only (/10 /15 /20
/50 /80 /90), no arbitrary values, Inter only. If you need a component the system lacks (Sheet,
Tooltip, Kbd, Skeleton, ToggleGroup, Separator), draw a labelled placeholder and list it.

The product is "回憶", a private diary-like album that merges LINE, Slack and photos into one
timeline and lets the owner write about each day. UI copy is Traditional Chinese. Use fixture
data only: authors Alice and Bob, invented messages, chart-1..5 blocks as photos. Scale: about
14,000 events over 18 months, some days with several hundred messages and photo bursts of
several hundred.

Draw a .dc.html canvas with these screens, each at 1280x800 and 390x844, light and dark via
data-scheme on <html>:
1. Month calendar with cover photos (fallback: memory line, then a message excerpt).
2. Lightbox with previous/next, filmstrip and a two-state 設為封面 button.
3. Zoom transitions year -> month -> day: start and end frames, morphing element marked.
4. Month scrubber beside the day stream.
5. Date jump (CommandDialog) and a keyboard-shortcuts overlay.
6. Restyle of the year heatmap (month rows), day stream (quote rows, owner indented, photo
   bursts with +N), notes panel with 眉批 annotation cards, phone bottom sheet (peek and open),
   and the conflict view (two version cards with changed lines highlighted).

For each screen include empty, loading, error and busiest-day states. Name artboards
"screen / state / viewport / scheme". Where a choice is open, show two options side by side and
say what differs. Keep a short decisions list in the chat, naming every component with its
variant and size.
```
