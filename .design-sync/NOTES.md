# design-sync notes — libs/rainforest-react

Synced with the bundled design-sync skill 2.1.281 (Claude Code 2.1.281), storybook shape, into a NEW design-system project (owner decision 2026-09-25: leave the hand-authored "rainforest.tools Design System" b6041f7f untouched). The new project is created at upload time; its projectId is recorded in config.json then.

## Fixes

- [GENERAL] `! preview decorator bundle failed: Could not resolve "tailwindcss"` -> `.storybook/preview.tsx` imports `../src/styles.css`, the Tailwind v4 source (`@import 'tailwindcss'`), and the decorator bundle's plugins are hardcoded (no `storyImports.loaders`) -> forked `source-storybook.mjs` into `.design-sync/overrides/` with a `css-empty` plugin on the decorator bundle only; the shipped `dist/styles.css` already carries every class. Needs `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` per clone.
- [GENERAL] `[EXPORT_COLLISION]` lucide-react exports icons named Badge, Command, Sheet, Table -> the DS components win the global merge (wanted) -> `storyImports.bundle: ["lucide-react"]` so story icon imports resolve from source.
- [GENERAL] Every story has a `Dark` twin driven by story-level `globals: { scheme: 'dark' }`; the converter passes `globals: {}`, so Dark previews render light and would grade as mismatches -> every `*--dark` story id is in `overrides.<Name>.skip`. The scheme is a token concern: `data-scheme="dark"` on `<html>` flips every token; previews show light.
- `[TOKENS_MISSING]` for `--available-height`, `--anchor-width`, `--transform-origin`, `--drawer-swipe-movement-x`, `--tw` is expected: Base UI sets the first four as inline styles at runtime, and `--tw` is a Tailwind internal. No action.
- ScrollArea `Filmstrip` is wider than a grid cell (`[GRID_OVERFLOW] wide`) -> `cardMode: "column"`.
- Overlay components (Dialog, Select, Popover, DropdownMenu, Command, Toaster, Sheet, Tooltip) use `cardMode: "single"` because their open stories portal to `body`.
- Storybook reference captures are cropped to the story root's height (`layout: 'fullscreen'`, `min-h-24`), so fixed-position overlays can be cut off on the storybook side; judge the visible part and the preview on its own (Dialog Default).

## Environment

- Built on Node 26 (the repo pins 22.x; no version manager on this machine). CI runs 22.
- Select `Open`: the cropped storybook canvas also changes overlay _positioning_. `SelectContent` uses Base UI's `alignItemWithTrigger`, which measures room above the trigger; with the reference cropped, it swaps the group label for the scroll-up arrow, while the preview (with room) shows the label. Graded `match` on the preview's own render. Reproduces deterministically.

## Re-sync risks

- The `source-storybook.mjs` fork pins the converter's decorator-bundle code as of skill 2.1.281. After a skill update, re-copy the upstream module, re-apply the `css-empty` plugin (one plugin object + one entry in the decorator `plugins` list), and diff the rest. If upstream gains a css loader option for the decorator bundle, drop the fork.
- Dark stories are skipped, so dark-scheme rendering is never graded here. It is covered only by the apps' own checks. Adding a story with a different id than `*--dark` that sets `globals.scheme` would grade light.
- Overlay references (Dialog, Sheet, Select) are cropped by storybook's story-root capture height; their grades lean on the preview's own render. If `.storybook/preview.tsx` layout changes (e.g. a taller `min-h`), re-check those three against the fresh reference.
- `libs/rainforest-react/conventions.md` is the README header and lists utility classes by name. Any change to the safelist in `libs/rainforest-react/src/styles.css` or the tokens in `libs/rainforest-ui/src/tailwindcss/shadcn.ts` must keep that file true: re-run the class check against `ds-bundle/_ds_bundle.css`.
- The old hand-authored project b6041f7f stays as it is (templates, ui_kits, guidelines, tokens). Templates for the new project are rebuilt from the shipped app screens, not copied from it.
