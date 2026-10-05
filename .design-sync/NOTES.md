# design-sync notes — libs/rainforest-react

Synced with the bundled design-sync skill 2.1.281 (Claude Code 2.1.281), storybook shape, into a NEW design-system project (owner decision 2026-09-25: leave the hand-authored "rainforest.tools Design System" b6041f7f untouched). Uploaded 2026-09-26 to "rainforest.tools React Design System" (4c25a390, pinned in config.json): 24 components, 70 stories graded match, report_validate bad/thin/variantsIdentical = 0. Re-synced 2026-09-30 with skill 2.1.285 after PR #418 (Spinner, Empty, Label, Field, ButtonGroup, Item): 30 components. Re-synced 2026-10-05 with skill 2.1.289 after #447 (darker light success/warning/info) and #479 (ItemSeparator dividers): only Item re-graded; Badge and Alert spot-checked for the new tokens.

## Fixes

- [GENERAL] `! preview decorator bundle failed: Could not resolve "tailwindcss"` -> `.storybook/preview.tsx` imports `../src/styles.css`, the Tailwind v4 source (`@import 'tailwindcss'`), and the decorator bundle's plugins are hardcoded (no `storyImports.loaders`) -> forked `source-storybook.mjs` into `.design-sync/overrides/` with a `css-empty` plugin on the decorator bundle only; the shipped `dist/styles.css` already carries every class. Needs `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` per clone.
- [GENERAL] `[EXPORT_COLLISION]` lucide-react exports icons named Badge, Command, Sheet, Table -> the DS components win the global merge (wanted) -> `storyImports.bundle: ["lucide-react"]` so story icon imports resolve from source.
- [GENERAL] Every story has a `Dark` twin driven by story-level `globals: { scheme: 'dark' }`; the converter passes `globals: {}`, so Dark previews render light and would grade as mismatches -> every `*--dark` story id is in `overrides.<Name>.skip`. The scheme is a token concern: `data-scheme="dark"` on `<html>` flips every token; previews show light.
- `[TOKENS_MISSING]` for `--available-height`, `--anchor-width`, `--transform-origin`, `--drawer-swipe-movement-x`, `--tw` is expected: Base UI sets the first four as inline styles at runtime, and `--tw` is a Tailwind internal. No action.
- ScrollArea `Filmstrip`, ButtonGroup `WithText` and Item's rows are wider than a grid cell (`[GRID_OVERFLOW] wide`) -> `cardMode: "column"`.
- [GENERAL] Item `DeliveryRows` preview lost its row divider: the story's `not-last:border-b-border` was not in the `@source inline(...)` safelist of `libs/rainforest-react/src/styles.css`, so `_ds_bundle.css` lacked it while storybook (which scans story files) had it -> safelisted `{,not-last:}border-{t,b}-border`. Designs only get the safelist, so any class a story uses must be in it.
- Overlay components (Dialog, Select, Popover, DropdownMenu, Command, Toaster, Sheet, Tooltip) use `cardMode: "single"` because their open stories portal to `body`.
- Storybook reference captures are cropped to the story root's height (`layout: 'fullscreen'`, `min-h-24`), so fixed-position overlays can be cut off on the storybook side; judge the visible part and the preview on its own (Dialog Default).

## Environment

- Run the driver with `--node-modules apps/rss-manager/node_modules` (or any app that depends on the package). `libs/rainforest-react/node_modules` has no self-link, so the converter reports `[NO_DIST]` there. Changing this path clears every grade once (`contract changed`), even with the library source untouched.
- First sync built on Node 26; the 2026-09-30 re-sync ran on Node 22.14. The pin is now Node 24 (`.nvmrc`), but the 2026-10-05 re-sync ran on Node 26.8.2 because this machine has no Node 24. No spot-check diverged.
- zsh here has `noclobber`: redirect logs with `>|`, or `> file` fails and a `tail` shows the previous run's log.
- Select `Open`: the cropped storybook canvas also changes overlay _positioning_. `SelectContent` uses Base UI's `alignItemWithTrigger`, which measures room above the trigger; with the reference cropped, it swaps the group label for the scroll-up arrow, while the preview (with room) shows the label. Graded `match` on the preview's own render. Reproduces deterministically.

## Project templates

The `templates/` in project 4c25a390 are hand-written `.dc.html` files, not converter output, and have no local source. The sync never touches them. On 2026-10-01, calibre-library, rss-manager and personal-memories were redrawn with the #418 components. Traps in the `.dc.html` runtime:

- `class=` on an `<x-import>` replaces the component's own classes instead of merging with them. Use `className=`.
- `sc-for` wraps each item in a `display:contents` div, so sibling variants (`not-last:`, `first:`) never match across items. Row dividers are `<ItemSeparator />` before every `Item` inside the loop: `ItemGroup` hides a separator that is the first or last child of a one-row wrapper, so no index logic is needed. For any other per-item difference, compute the class in the logic.
- The DS global is not reachable from the component logic. A `render` prop gets a plain element carrying `buttonVariants()` classes, read once from the bundle.
- `componentDidUpdate` is called without `prevProps`; guard before reading `pp.*`.
- As of 2026-10-05 no template has `not-last:border-b-border` inside `sc-for`. Two templates still draw a last-row border in JS: CalibreLibrary `deliveryRows` (`border-b-border` when `i < length-1`, at 3 `sc-for` sites) and RssManager (`rowCls` on table rows and queue items). They are candidates for `<ItemSeparator />`.
- Verify a template by uploading a copy as `_draft-<Name>.dc.html` without its `@template` line, rendering it with `render_preview` plus Playwright, then overwriting the real file and deleting the draft.

## Re-sync risks

- Story-only Tailwind classes: a class that appears in a story but not in the safelist renders in storybook and silently vanishes from the preview and from every design. After adding stories, check each `className="..."` token in `libs/rainforest-react/stories/*.stories.tsx` against `ds-bundle/_ds_bundle.css`, and safelist what is missing.
- The 2026-09-30 re-sync re-graded only the reference-drift canary picks (Command, Tooltip, Sheet, Dialog, Table) plus the six new components; the other 19 carried their 2026-09-26 grades by anchor. Sheet `Bottom Peek`: the reference capture is 48px taller than the preview, so it shows more of the peeking panel below the fold; the peek's top edge is at the same y.
- The `source-storybook.mjs` fork pins the converter's decorator-bundle code as of skill 2.1.281. After a skill update, re-copy the upstream module, re-apply the `css-empty` plugin (one plugin object + one entry in the decorator `plugins` list), and diff the rest. If upstream gains a css loader option for the decorator bundle, drop the fork.
- Dark stories are skipped, so dark-scheme rendering is never graded here. It is covered only by the apps' own checks. Adding a story with a different id than `*--dark` that sets `globals.scheme` would grade light.
- Overlay references (Dialog, Sheet, Select) are cropped by storybook's story-root capture height; their grades lean on the preview's own render. If `.storybook/preview.tsx` layout changes (e.g. a taller `min-h`), re-check those three against the fresh reference.
- Token changes (like #447) count as styling, so the driver carries every grade and does not recapture the affected components. Spot-check Badge and Alert by hand: `compare.mjs --components Badge,Alert --spot-check-components Badge,Alert`.
- `conventions.md` claims `bg-`/`text-`/`border-`/`ring-` exist "for every token above". On 2026-10-05 the bundle had none of these for `chart-1..5` or `sidebar-foreground` (only `fill-`/`stroke-chart-*` and `bg-sidebar`). Either narrow the sentence or safelist them.
- `libs/rainforest-react/conventions.md` is the README header and lists utility classes by name. Any change to the safelist in `libs/rainforest-react/src/styles.css` or the tokens in `libs/rainforest-ui/src/tailwindcss/shadcn.ts` must keep that file true: re-run the class check against `ds-bundle/_ds_bundle.css`.
- The old hand-authored project b6041f7f stays as it is (templates, ui_kits, guidelines, tokens). Templates for the new project are rebuilt from the shipped app screens, not copied from it.
