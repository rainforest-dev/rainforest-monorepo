# Shadcn-first shared library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shadcn primitives Spinner, Empty, Label, Field, ButtonGroup and Item to `@rainforest-dev/rainforest-react`, replace handmade UI with them in calibre, rss-manager and memories, and raise the shared theme's primary pair to WCAG AA so calibre's per-component contrast workarounds can go.

**Architecture:** Each primitive is copied from the shadcn `base-nova` registry with a pinned CLI, adapted to the lib's conventions (recipes in `@rainforest-dev/rainforest-ui/recipes`, no `dark:`, lucide icons, one docstring), exported from `src/index.ts`, covered by a Vitest file and a Storybook file, and registered in `.design-sync/config.json`. The theme change is two lightness values plus four fallback hexes in the shared Tailwind plugin, pinned by a contrast unit test. App tasks swap markup at the sites the spec names and extend the calibre e2e suite where behaviour must hold.

**Tech Stack:** React 19.2.3, `@base-ui/react` 1.8.0, Tailwind 4.2.2 (catalog), `class-variance-authority` 0.7.1, `lucide-react` 1.46.0, Storybook 10.5.3, Vitest 4.1.4, TypeScript 6.0.3, Next.js 16.2.11 (calibre), Astro 7.3.3 (rss-manager, memories), Playwright 1.63.0 with `@axe-core/playwright`, shadcn CLI 4.21.0 (only to view registry items).

**Spec:** `docs/superpowers/specs/2026-09-30-shadcn-first-library-design.md`

## Global Constraints

- Work only in `/Users/rainforest/Repositories/rainforest-monorepo/.claude/worktrees/shared-library-components` (branch `feat/shared-library-components`). Never `cd` to the main checkout. Never `git stash`.
- Run tasks through `pnpm nx`, never npm scripts, `vitest` or `playwright` directly. Commands that build (lib tests, Storybook, e2e, dev, build) take `--skip-nx-cache`, because AGENTS.md warns that building inside a worktree corrupts the shared Nx cache.
- Wrap every long command in a hard timeout: `perl -e 'alarm 900; exec @ARGV' -- <command>`.
- Versions come from the manifests and `pnpm-lock.yaml`. Add or upgrade no dependency. `merge-props` and `use-render` are entry points of the installed `@base-ui/react` 1.8.0. Calibre keeps zod 3.25.
- Registry source: `pnpm dlx shadcn@4.21.0 view https://ui.shadcn.com/r/styles/base-nova/<name>.json`. Never `shadcn add` (the lib has no `components.json`).
- Adaptation rules for registry code (spec, "How the existing components were added"): `cn` from `../lib/cn`; `IconPlaceholder lucide="X"` becomes a `lucide-react` import; drop every `dark:` class; `cva` recipes go to `libs/rainforest-ui/src/recipes/<name>.ts` with the docstring "Class recipe behind `X`." and an `XVariantProps` type; `cn-font-heading` becomes `font-heading`; one-line docstring on the main exported component only; `export type XProps`; keep the registry's `'use client'` and add it where the file calls a hook.
- Semantic tokens only: no hex, no raw palette classes, no `dark:`. The lib's `contract.test.ts` and the recipes test enforce it.
- Comment allow-list: a docstring on an exported lib component; one line naming an external constraint; the reason on a lint suppression; `TODO(<ticket>)`. No JSDoc on props, fields or private helpers, no history. Last step of every task: `git diff -U0 HEAD~1 | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'` and justify each hit against this list (for Task 1, which does not commit, skip it).
- Fixture data only: made-up titles and names in stories and tests; calibre captures use the seeded fixture, memories the synthetic fixture, rss-manager the fixture vault in Task 1.
- Calibre e2e servers: Playwright leaves the `next dev` grandchild running. Before and after every calibre e2e run: `pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids`. `next dev` rewrites `apps/personal-calibre/next-env.d.ts`; restore it with `git checkout -- apps/personal-calibre/next-env.d.ts` before every commit.
- Calibre e2e specs that write deliveries touch only their own books: deliveries spec 41 and 42, bulk spec the books it selects in `/?series=2` with Readwise Reader.
- Node: the default Node 22 runs everything. If a tool fails with an `import.meta.main` or syntax error, prefix the command with `PATH="$HOME/.asdf/installs/nodejs/22.23.2/bin:$PATH"`.
- Imports sorted by `simple-import-sort` (`pnpm nx lint <project> --fix` sorts them). Single quotes. lint-staged runs prettier on commit.
- Captures go to `CAPTURE_DIR`, the executing session's scratchpad directory (`/tmp/shadcn-first-captures` when the session has none). Never inside the repo, never committed.
- Commits: conventional, scope named per task, path-scoped `git add` of the task's files only (never `git add -A` or `git add .`), no `--no-verify`, no signing flags. Every message ends with a blank line and exactly:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm
  ```

## Review Focus

1. A mouse click on a tile's select mark: it toggles selection, does not open the book, leaves focus on the tile (so the roving index stays right) and adds no Tab stop. Test: Task 9 step 1.
2. Keyboard selection on a focused tile still toggles once per key press (the checkbox must not add a second Space handler). Test: Task 9 step 1 presses `x` and Space after the swap and checks `aria-selected` each time.
3. Double submit while a request runs: Save and Mark delivered stay disabled with the spinner shown until the response lands. Tests: Task 11 step 1, Task 12 step 1.
4. A re-seeded theme: the primary pair must still pass with the violet and amber seeds the Storybook toolbar offers. Test: Task 2 step 1 (`it.each` over three seeds).
5. An invalid Reference URL: the error stays announced (`role="alert"`) and `aria-describedby` still points at it after the move to `FieldError`. Test: Task 11 step 1.

---

### Task 1: Install, baseline and "before" captures

No commit. This task records the state every later task is compared with.

**Files:**

- Create (outside the repo): `$CAPTURE_DIR/capture.cjs`, `$CAPTURE_DIR/rss-vault/RSS-Source-Registry.md`, `$CAPTURE_DIR/rss-vault/RSS-Topic-Registry.md`, `$CAPTURE_DIR/before/*`

**Interfaces:**

- Produces: `capture.cjs` usage `node capture.cjs <before|after> <name> <url> [selector]`, used again in Task 15.

- [ ] **Step 1: Install dependencies in the worktree**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo/.claude/worktrees/shared-library-components
perl -e 'alarm 900; exec @ARGV' -- pnpm install --frozen-lockfile
```

Expected: exit 0, no lockfile change (`git status --short` prints nothing).

- [ ] **Step 2: Record the baseline of every suite this plan must keep green**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck test -p rainforest-ui rainforest-react personal-calibre personal-calibre-e2e rss-manager personal-memories --skip-nx-cache
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 1800; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
git checkout -- apps/personal-calibre/next-env.d.ts
```

Expected: all green. Write any failure, with its test title, into `$CAPTURE_DIR/baseline.txt`; a failure present here is pre-existing and later tasks are not blamed for it. The e2e run also creates the calibre fixture at `apps/personal-calibre-e2e/test-output/fixtures`.

- [ ] **Step 3: Write the capture script**

`$CAPTURE_DIR/capture.cjs`:

```js
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const REPO =
  '/Users/rainforest/Repositories/rainforest-monorepo/.claude/worktrees/shared-library-components';
const { chromium } = require(
  require.resolve('@playwright/test', {
    paths: [path.join(REPO, 'apps/personal-calibre-e2e')],
  }),
);

const [label, name, url, selector = ''] = process.argv.slice(2);
const outDir = path.join(process.env.CAPTURE_DIR, label);

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'light',
    deviceScaleFactor: 2,
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  const found = await page.evaluate((sel) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--primary)';
    document.body.append(probe);
    const primary = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const target =
      (sel ? [...document.querySelectorAll(sel)].find(visible) : undefined) ??
      [...document.querySelectorAll('button, a')].find(
        (el) => visible(el) && getComputedStyle(el).backgroundColor === primary,
      );
    if (!target) return null;
    target.setAttribute('data-capture-target', '');
    const rgba = (c) => {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    };
    const lin = (v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const lum = ([r, g, b]) =>
      0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const style = getComputedStyle(target);
    const bg = rgba(style.backgroundColor);
    const fg = rgba(style.color);
    const [hi, lo] = [lum(bg), lum(fg)].sort((a, b) => b - a);
    return {
      matchedBy: sel && target.matches(sel) ? 'selector' : 'primary background',
      text: target.textContent.trim() || target.getAttribute('aria-label'),
      background: style.backgroundColor,
      color: style.color,
      ratio:
        bg[3] === 255
          ? Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
          : null,
    };
  }, selector);
  const record = {
    name,
    url,
    selector,
    commit: execSync('git rev-parse --short HEAD', { cwd: REPO })
      .toString()
      .trim(),
    capturedAt: new Date().toISOString(),
    colorScheme: 'light',
    found,
  };
  if (found) {
    const box = await page
      .locator('[data-capture-target]')
      .first()
      .boundingBox();
    const pad = 24;
    await page.screenshot({
      path: path.join(outDir, `${name}.png`),
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      },
    });
  }
  await page.screenshot({ path: path.join(outDir, `${name}--page.png`) });
  fs.writeFileSync(
    path.join(outDir, `${name}.json`),
    JSON.stringify(record, null, 2),
  );
  console.log(JSON.stringify(record));
  await browser.close();
})();
```

- [ ] **Step 4: Write the rss-manager fixture vault**

```bash
mkdir -p "$CAPTURE_DIR/rss-vault"
cat > "$CAPTURE_DIR/rss-vault/RSS-Source-Registry.md" <<'EOF'
---
type: source-registry
updated: 2026-06-17
---

# RSS Source Registry

## Active Sources

### Frontend & Web

- [x] **Example Frontend Notes** #domain/frontend #tech/css
  https://frontend.example.com/feed.xml

## Proposed Sources

- [ ] **Example Build Log** #devops #domain/frontend
  https://build.example.com/rss.xml · for topic: Build tooling · _2026-06-17_ · proposed by rss-discover
  **What**: Made-up fixture feed.

## No RSS Found

## Retired
EOF
cat > "$CAPTURE_DIR/rss-vault/RSS-Topic-Registry.md" <<'EOF'
---
type: topic-registry
updated: 2026-06-17
---

# RSS Topic Registry

## Active

- [x] **Frontend** #domain/frontend
  Made-up fixture topic

## Proposed

- [ ] **Home automation** #devops
  Made-up fixture topic

## Declined
EOF
```

- [ ] **Step 5: Capture calibre (before)**

```bash
pids=$(lsof -tiTCP:3335 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
FIX="$PWD/apps/personal-calibre-e2e/test-output/fixtures"
CALIBRE_LIBRARY_PATH="$FIX" CALIBRE_APP_DB_PATH="$FIX/app.db" CALIBRE_E2E=1 \
  pnpm nx dev personal-calibre --port=3335 --skip-nx-cache
```

Run it in the background, wait until `http://localhost:3335/favicon.ico` answers, then:

```bash
cd "$CAPTURE_DIR"
node capture.cjs before calibre-read 'http://localhost:3335/?book=38' 'a[href="/read/38"]'
node capture.cjs before calibre-empty 'http://localhost:3335/?q=zzzz-no-such-book' '[data-view-region]'
node capture.cjs before calibre-deliveries 'http://localhost:3335/?book=38' 'section:has([data-platform])'
node capture.cjs before calibre-sort 'http://localhost:3335/' 'div:has(> button[aria-label^="Sort direction"])'
```

Expected: each prints a record with `found` not null; `calibre-read` shows the secondary Read link (the workaround). Stop the server, then `git checkout -- apps/personal-calibre/next-env.d.ts`.

- [ ] **Step 6: Capture memories, rss-manager and the website (before)**

memories (same command as its e2e webServer, synthetic data):

```bash
DATA="$CAPTURE_DIR/memories-data"; NOTES="$CAPTURE_DIR/memories-notes"
rm -rf "$DATA" "$NOTES" && mkdir -p "$DATA" "$NOTES"
node apps/personal-memories/src/cli/fixture.ts "$DATA"
MEMORIES_DATA_DIR="$DATA" MEMORIES_NOTES_DIR="$NOTES" MEMORIES_OWNER=Bob MEMORIES_E2E=1 \
  MEMORIES_AUTHORS='alice@example.com=Alice,bob@example.com=Bob' \
  pnpm --dir apps/personal-memories exec astro dev --host 127.0.0.1 --port 3024 --ignore-lock
```

In the background; then `node capture.cjs before memories-primary 'http://127.0.0.1:3024/'`. Stop it.

rss-manager:

```bash
VAULT_PATH="$CAPTURE_DIR/rss-vault" pnpm nx dev rss-manager --skip-nx-cache
```

In the background (port 3002); then `node capture.cjs before rss-activate 'http://localhost:3002/?tab=sources'`. With no selector the script picks the first primary-filled button, which on the fixture vault is Activate on "Example Build Log"; check `found.text` says `Activate`. Stop it.

website:

```bash
pnpm nx dev personal-website --skip-nx-cache
```

In the background; use the URL it prints (Astro's default is `http://localhost:4321/`); then `node capture.cjs before website-fab '<url>' 'button[aria-label="back to top"], button[aria-label="contact me"]'`. Stop it.

Expected: a PNG and JSON per capture in `$CAPTURE_DIR/before`. A record with `found: null` means that page has no primary-filled control; keep the page screenshot and write the blocker next to it in `baseline.txt`.

---

### Task 2: Primary pair reaches WCAG AA

**Files:**

- Create: `libs/rainforest-ui/src/tailwindcss/shadcn.test.ts`
- Modify: `libs/rainforest-ui/src/tailwindcss/shadcn.ts:28-29`, `:101-102`, `:135-136`

**Interfaces:**

- Produces: light `--primary` `oklch(from var(--seed) 0.48 0.12 h)`, light `--primary-foreground` `oklch(from var(--seed) 0.99 0.012 h)`; fallback light `#007173` / `#f3fffe`, fallback dark `#43c3c4` / `#051212`.

- [ ] **Step 1: Write the failing test**

`libs/rainforest-ui/src/tailwindcss/shadcn.test.ts`:

```ts
import shadcn from './shadcn.js';

type Api = Parameters<ReturnType<typeof shadcn>['handler']>[0];
type Block = Record<string, string>;

const FALLBACK = '@supports not (color: oklch(from red l c h))';
const DARK = "[data-scheme='dark']";
const RELATIVE = /^oklch\(from var\(--seed\) ([\d.]+) ([\d.]+) h\)$/;
const PAIR = ['--primary', '--primary-foreground'] as const;

function baseStyles(): Record<string, unknown> {
  const bases: Record<string, unknown>[] = [];
  const api = {
    addBase: (base: Record<string, unknown>) => {
      bases.push(base);
    },
  } as unknown as Api;
  shadcn().handler(api);
  const [first] = bases;
  if (!first) throw new Error('the plugin added no base styles');
  return first;
}

function token(block: Block, name: string): string {
  const value = block[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * toLinear(r / 255) +
    0.7152 * toLinear(g / 255) +
    0.0722 * toLinear(b / 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

function hue(hex: string): number {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = toLinear(r8 / 255);
  const g = toLinear(g8 / 255);
  const b = toLinear(b8 / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
}

// Browsers clip an out-of-gamut oklch() per sRGB channel instead of reducing chroma.
function oklchToHex(L: number, C: number, h: number): string {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(1, toGamma(Math.max(0, c))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function resolve(value: string, seed: string): string {
  const match = RELATIVE.exec(value);
  if (!match) throw new Error(`not a seed-relative colour: ${value}`);
  return oklchToHex(Number(match[1]), Number(match[2]), hue(seed));
}

function channelDistance(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return Math.max(...x.map((c, i) => Math.abs(c - (y[i] ?? 0))));
}

const base = baseStyles();
const schemes: Array<[string, Block, Block]> = [
  [
    'light',
    base[':root'] as Block,
    (base[FALLBACK] as Record<string, Block>)[':root'] as Block,
  ],
  [
    'dark',
    base[DARK] as Block,
    (base[FALLBACK] as Record<string, Block>)[DARK] as Block,
  ],
];

describe('primary contrast', () => {
  describe.each(schemes)('%s', (_scheme, relative, fallback) => {
    it.each(['#66b2b2', '#7c5cff', '#e0784a'])(
      'resolves --primary on --primary-foreground to at least 4.5:1 with seed %s',
      (seed) => {
        const [primary, foreground] = PAIR.map((name) =>
          resolve(token(relative, name), seed),
        ) as [string, string];
        expect(contrast(primary, foreground)).toBeGreaterThanOrEqual(4.5);
      },
    );

    it('keeps the fallback pair at 4.5:1 or more', () => {
      expect(
        contrast(
          token(fallback, '--primary'),
          token(fallback, '--primary-foreground'),
        ),
      ).toBeGreaterThanOrEqual(4.5);
    });

    it.each(PAIR)('pre-resolves %s from the default seed', (name) => {
      expect(
        channelDistance(
          token(fallback, name),
          resolve(token(relative, name), '#66b2b2'),
        ),
      ).toBeLessThanOrEqual(1);
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx test rainforest-ui --skip-nx-cache -- src/tailwindcss/shadcn.test.ts`
Expected: FAIL. `light > resolves … with seed #66b2b2` fails near 4.18, and all four `pre-resolves` tests fail (the fallback hexes are hand approximations). The dark pair tests and both fallback-pair tests pass.

- [ ] **Step 3: Change the values**

In `libs/rainforest-ui/src/tailwindcss/shadcn.ts`, `lightVars`:

```ts
  '--primary': 'oklch(from var(--seed) 0.48 0.12 h)',
  '--primary-foreground': 'oklch(from var(--seed) 0.99 0.012 h)',
```

`fallbackLight`:

```ts
  '--primary': '#007173',
  '--primary-foreground': '#f3fffe',
```

`fallbackDark`:

```ts
  '--primary': '#43c3c4',
  '--primary-foreground': '#051212',
```

Leave `--ring`, `--chart-1`, the dark oklch values and every other fallback hex as they are.

- [ ] **Step 4: Run the test to verify it passes**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx test rainforest-ui --skip-nx-cache -- src/tailwindcss/shadcn.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Run the library's full checks**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck test -p rainforest-ui rainforest-react --skip-nx-cache`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/rainforest-ui/src/tailwindcss/shadcn.ts libs/rainforest-ui/src/tailwindcss/shadcn.test.ts
git commit -m "fix(rainforest-ui): raise the primary pair to WCAG AA

Light --primary drops to L 0.48 and --primary-foreground rises to L 0.99:
with the default seed the clipped pair goes from 4.18:1 to 5.69:1, and
primary text on background, sidebar and muted clears 4.5:1 too. The four
primary fallback hexes now equal the clipped resolution of the relative
colours. A unit test checks both pairs for three seeds and the fallbacks.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 3: Revert calibre's contrast workarounds

**Files:**

- Modify: `apps/personal-calibre/src/components/detail/BookDetail.tsx:154`
- Modify: `apps/personal-calibre/src/components/library/BulkToolbar.tsx:136-141`, `:150-155`
- Modify: `apps/personal-calibre/src/components/detail/DeliveryRows.tsx:199-206`
- Modify: `apps/personal-calibre/src/components/library/Facet.tsx:105`
- Modify: `apps/personal-calibre/src/components/library/FilterChips.tsx:41`
- Modify: `apps/personal-calibre/src/components/library/FilterPanel.tsx:52`
- Modify: `apps/personal-calibre/src/components/views/GroupHeading.tsx:36`

**Interfaces:**

- Consumes: Task 2's primary values.
- Produces: primary CTAs back on `variant="default"` and link buttons back on `text-primary`; Tasks 11 and 12 write their files from this state.

- [ ] **Step 1: Make the edits**

`BookDetail.tsx`:

```tsx
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
```

becomes

```tsx
            className={buttonVariants({ size: 'sm' })}
```

`BulkToolbar.tsx`, Select all:

```tsx
        <Button
          variant="link"
          size="xs"
          className="text-foreground"
          disabled={busy}
          onClick={() => addMany(matchingIds)}
        >
```

becomes

```tsx
        <Button
          variant="link"
          size="xs"
          disabled={busy}
          onClick={() => addMany(matchingIds)}
        >
```

and Mark delivered:

```tsx
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || !platformKey}
          onClick={() => void markDelivered()}
        >
```

becomes

```tsx
        <Button
          size="sm"
          disabled={busy || !platformKey}
          onClick={() => void markDelivered()}
        >
```

`DeliveryRows.tsx`:

```tsx
<Button type="submit" variant="secondary" size="sm" disabled={saving}>
  Save
</Button>
```

becomes

```tsx
<Button type="submit" size="sm" disabled={saving}>
  Save
</Button>
```

Class names: `Facet.tsx` `className="text-foreground self-start"` becomes `className="self-start"`; `FilterChips.tsx` `className="text-foreground shrink-0"` becomes `className="shrink-0"`; `FilterPanel.tsx` `className="text-foreground ml-auto"` becomes `className="ml-auto"`; `GroupHeading.tsx` `className="text-foreground ml-auto"` becomes `className="ml-auto"`. Leave `DeliveryPills.tsx` alone (success token, not primary).

- [ ] **Step 2: Confirm nothing is left**

Run: `git grep -n "text-foreground" -- apps/personal-calibre/src/components/library/Facet.tsx apps/personal-calibre/src/components/library/FilterChips.tsx apps/personal-calibre/src/components/library/FilterPanel.tsx apps/personal-calibre/src/components/views/GroupHeading.tsx apps/personal-calibre/src/components/library/BulkToolbar.tsx; git grep -n "variant=\"secondary\"\|variant: 'secondary'" -- apps/personal-calibre/src/components/detail apps/personal-calibre/src/components/library/BulkToolbar.tsx`
Expected: no output.

- [ ] **Step 3: Run the axe specs and the token colour check**

```bash
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 900; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- --grep "axe violations|focus is foreground and selection is primary"
perl -e 'alarm 900; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- --project=phone --grep "axe"
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
```

Expected: PASS. A `color-contrast` failure here means Task 2 did not land in the build the dev server used; rerun after `pnpm nx build rainforest-ui --skip-nx-cache`.

- [ ] **Step 4: Typecheck, lint, commit**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck -p personal-calibre
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/components/detail/BookDetail.tsx apps/personal-calibre/src/components/library/BulkToolbar.tsx apps/personal-calibre/src/components/detail/DeliveryRows.tsx apps/personal-calibre/src/components/library/Facet.tsx apps/personal-calibre/src/components/library/FilterChips.tsx apps/personal-calibre/src/components/library/FilterPanel.tsx apps/personal-calibre/src/components/views/GroupHeading.tsx
git commit -m "fix(personal-calibre): put primary controls back on the primary token

The shared primary now reaches 4.5:1, so the Read link, Mark delivered
and Save return to the default variant and the link-styled buttons drop
text-foreground. DeliveryPills keeps it: that Badge is the success token.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 4: Spinner

**Files:**

- Create: `libs/rainforest-react/src/components/spinner.tsx`
- Create: `libs/rainforest-react/src/spinner.test.tsx`
- Create: `libs/rainforest-react/stories/Spinner.stories.tsx`
- Modify: `libs/rainforest-react/src/index.ts`, `libs/rainforest-react/src/contract.test.ts`, `libs/rainforest-react/src/dist.test.ts`, `libs/rainforest-react/conventions.md`, `.design-sync/config.json`

**Interfaces:**

- Produces: `Spinner(props: React.ComponentProps<'svg'>)` rendering `<svg data-slot="spinner" role="status" aria-label="Loading">`; `SpinnerProps`. Usage inside a button: `<Spinner data-icon="inline-start" />` before the label.

- [ ] **Step 1: View the registry item**

Run: `pnpm dlx shadcn@4.21.0 view https://ui.shadcn.com/r/styles/base-nova/spinner.json`
Expected: one file, `Loader2Icon` through `IconPlaceholder`, `role="status"`, `aria-label="Loading"`, `size-4 animate-spin`.

- [ ] **Step 2: Write the failing test**

`libs/rainforest-react/src/spinner.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { Button, Spinner } from './index';

describe('Spinner', () => {
  it('is a status named Loading that spins', () => {
    render(<Spinner />);
    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner.getAttribute('data-slot')).toBe('spinner');
    expect(spinner.getAttribute('class')).toContain('animate-spin');
    expect(spinner.getAttribute('class')).toContain(
      'motion-reduce:animate-none',
    );
  });

  it('takes a caller label and size', () => {
    render(<Spinner aria-label="Saving" className="size-6" />);
    const spinner = screen.getByRole('status', { name: 'Saving' });
    expect(spinner.getAttribute('class')).toContain('size-6');
    expect(spinner.getAttribute('class')).not.toContain('size-4');
  });

  it('sits before the label inside a disabled Button', () => {
    render(
      <Button disabled>
        <Spinner data-icon="inline-start" />
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: /Save/ });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(
      button.querySelector('[data-slot="spinner"]')?.getAttribute('data-icon'),
    ).toBe('inline-start');
  });
});
```

Add `'Spinner',` to `componentNames` in `src/contract.test.ts` (alphabetical, after `'Skeleton',`). In `src/dist.test.ts`, add `'animate-spin',` to the list in `includes the classes the new components use`.

- [ ] **Step 3: Run it to verify it fails**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx test rainforest-react --skip-nx-cache -- src/spinner.test.tsx src/contract.test.ts`
Expected: FAIL, `Spinner` is not exported.

- [ ] **Step 4: Write the component, export and story**

`libs/rainforest-react/src/components/spinner.tsx`:

```tsx
import { Loader2Icon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/cn';

/** A spinning indicator for a pending action. Put it inside the Button whose request is running. */
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn(
        'size-4 animate-spin motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };

export type SpinnerProps = React.ComponentProps<typeof Spinner>;
```

In `src/index.ts`, add after `export * from './components/sonner';`:

```ts
export * from './components/spinner';
```

`libs/rainforest-react/stories/Spinner.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button, Spinner } from '../src';

const meta = {
  title: 'Feedback/Spinner',
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InButton: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button size="sm" disabled>
        <Spinner data-icon="inline-start" />
        Save
      </Button>
      <Button size="sm" variant="outline" disabled>
        <Spinner data-icon="inline-start" />
        ZIP
      </Button>
      <Button size="xs" disabled>
        <Spinner data-icon="inline-start" />
        Activate
      </Button>
    </div>
  ),
};

export const Dark: Story = { globals: { scheme: 'dark' } };
```

In `.design-sync/config.json`, inside `overrides`, insert after the `"Skeleton"` entry:

```json
    "Spinner": {
      "skip": ["feedback-spinner--dark"]
    },
```

In `libs/rainforest-react/conventions.md`, replace the last bullet of `## Composition`

```markdown
- Loading states use `Skeleton` blocks sized like the content they stand for, never a spinner
  alone.
```

with

```markdown
- Loading states use `Skeleton` blocks sized like the content they stand for, never a spinner
  alone.
- A pending action puts `Spinner` inside its own button, before the label
  (`<Spinner data-icon="inline-start" />`), keeps the label and disables the button until the
  request settles.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx test rainforest-react --skip-nx-cache`
Expected: PASS, including `dist.test.ts` finding `.animate-spin`.

- [ ] **Step 6: Lint, typecheck, Storybook build**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck -p rainforest-react
perl -e 'alarm 900; exec @ARGV' -- pnpm nx build-storybook rainforest-react --skip-nx-cache
```

Expected: PASS; the Storybook build lists `feedback-spinner--default`, `--in-button` and `--dark`.

- [ ] **Step 7: Commit**

```bash
git add libs/rainforest-react/src/components/spinner.tsx libs/rainforest-react/src/spinner.test.tsx libs/rainforest-react/stories/Spinner.stories.tsx libs/rainforest-react/src/index.ts libs/rainforest-react/src/contract.test.ts libs/rainforest-react/src/dist.test.ts libs/rainforest-react/conventions.md .design-sync/config.json
git commit -m "feat(rainforest-react): add Spinner from the shadcn base-nova registry

Copied with shadcn@4.21.0 view: Loader2Icon from lucide-react, and
motion-reduce stops the spin as Skeleton stops its pulse. Stories, a
design-sync skip for the Dark story and a conventions rule for pending
buttons come with it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 5: Empty

**Files:**

- Create: `libs/rainforest-ui/src/recipes/empty.ts`
- Create: `libs/rainforest-react/src/components/empty.tsx`
- Create: `libs/rainforest-react/src/empty.test.tsx`
- Create: `libs/rainforest-react/stories/Empty.stories.tsx`
- Modify: `libs/rainforest-ui/src/recipes/index.ts`, `libs/rainforest-ui/src/recipes/recipes.test.ts`, `libs/rainforest-react/src/index.ts`, `libs/rainforest-react/src/contract.test.ts`, `libs/rainforest-react/conventions.md`, `.design-sync/config.json`

**Interfaces:**

- Produces: `Empty`, `EmptyHeader`, `EmptyMedia` (`variant?: 'default' | 'icon'`), `EmptyTitle`, `EmptyDescription`, `EmptyContent`, all `div`s with `data-slot` `empty`, `empty-header`, `empty-icon`, `empty-title`, `empty-description`, `empty-content`; `emptyMediaVariants`; `EmptyProps`. No ARIA role on any part.

- [ ] **Step 1: View the registry item**

Run: `pnpm dlx shadcn@4.21.0 view https://ui.shadcn.com/r/styles/base-nova/empty.json`
Expected: `emptyMediaVariants` via cva and six parts; `EmptyTitle` uses `cn-font-heading`.

- [ ] **Step 2: Write the failing tests**

`libs/rainforest-react/src/empty.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { SearchXIcon } from 'lucide-react';

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './index';

describe('Empty', () => {
  it('lays out media, title, description and the next action in slots', () => {
    const { container } = render(
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No books match these filters.</EmptyTitle>
          <EmptyDescription>Try fewer filters.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button>Clear filters</Button>
        </EmptyContent>
      </Empty>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset['slot']).toBe('empty');
    expect(
      screen.getByText('No books match these filters.').dataset['slot'],
    ).toBe('empty-title');
    const media = root.querySelector('[data-slot="empty-icon"]') as HTMLElement;
    expect(media.dataset['variant']).toBe('icon');
    expect(media.className).toContain('bg-muted');
    expect(
      screen
        .getByRole('button', { name: 'Clear filters' })
        .closest('[data-slot="empty-content"]'),
    ).not.toBeNull();
  });

  it('adds no role, so an error keeps using Alert', () => {
    const { container } = render(
      <Empty>
        <EmptyTitle>Nothing yet.</EmptyTitle>
      </Empty>,
    );
    expect(container.querySelector('[role]')).toBeNull();
  });
});
```

In `libs/rainforest-ui/src/recipes/recipes.test.ts`, add `emptyMediaVariants,` to the import list (alphabetical, after `cn,`) and add inside `describe('recipes', …)`:

```ts
it('resolve the Empty media variants', () => {
  expect(emptyMediaVariants()).toContain('bg-transparent');
  expect(emptyMediaVariants({ variant: 'icon' })).toContain('bg-muted');
});
```

Add `'Empty',` to `componentNames` in `libs/rainforest-react/src/contract.test.ts` (after `'DropdownMenu',`).

- [ ] **Step 3: Run them to verify they fail**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t test -p rainforest-ui rainforest-react --skip-nx-cache`
Expected: FAIL, `emptyMediaVariants` and `Empty` do not exist.

- [ ] **Step 4: Write the recipe, the component, the exports and the story**

`libs/rainforest-ui/src/recipes/empty.ts`:

```ts
import { cva, type VariantProps } from 'class-variance-authority';

/** Class recipe behind `EmptyMedia`. */
export const emptyMediaVariants = cva(
  'mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type EmptyMediaVariantProps = VariantProps<typeof emptyMediaVariants>;
```

In `libs/rainforest-ui/src/recipes/index.ts`, add after `export * from './cn.js';`:

```ts
export * from './empty.js';
```

`libs/rainforest-react/src/components/empty.tsx`:

```tsx
import {
  type EmptyMediaVariantProps,
  emptyMediaVariants,
} from '@rainforest-dev/rainforest-ui/recipes';
import type * as React from 'react';

import { cn } from '../lib/cn';

/** A region with nothing to show: media, a title, a line of help and the next action. */
function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      className={cn(
        'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 text-balance rounded-xl border-dashed p-6 text-center',
        className,
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-header"
      className={cn('flex max-w-sm flex-col items-center gap-2', className)}
      {...props}
    />
  );
}

function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & EmptyMediaVariantProps) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-title"
      className={cn(
        'font-heading text-sm font-medium tracking-tight',
        className,
      )}
      {...props}
    />
  );
}

function EmptyDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        'text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4',
        className,
      )}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        'flex w-full min-w-0 max-w-sm flex-col items-center gap-2.5 text-balance text-sm',
        className,
      )}
      {...props}
    />
  );
}

export {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
};

export type EmptyProps = React.ComponentProps<typeof Empty>;

export { emptyMediaVariants };
```

In `libs/rainforest-react/src/index.ts`, add after `export * from './components/dropdown-menu';`:

```ts
export * from './components/empty';
```

`libs/rainforest-react/stories/Empty.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchXIcon } from 'lucide-react';

import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../src';

const meta = {
  title: 'Feedback/Empty',
  component: Empty,
} satisfies Meta<typeof Empty>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle>No books match these filters.</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm">
          Clear filters
        </Button>
      </EmptyContent>
    </Empty>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>No reading queue has been generated yet.</EmptyTitle>
        <EmptyDescription>
          Run the <code className="text-primary">reading-queue</code> skill to
          build one.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  ),
};

export const Dark: Story = {
  render: Default.render,
  globals: { scheme: 'dark' },
};
```

In `.design-sync/config.json`, insert after the `"DropdownMenu"` entry:

```json
    "Empty": {
      "skip": ["feedback-empty--dark"]
    },
```

In `libs/rainforest-react/conventions.md`, append to `## Composition`:

```markdown
- A region with nothing to show uses `Empty`: a title, at most one line of help, and the next
  action in `EmptyContent`. Errors keep `Alert`, whose `role="alert"` announces them.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t test -p rainforest-ui rainforest-react --skip-nx-cache`
Expected: PASS.

- [ ] **Step 6: Lint, typecheck, Storybook build**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck -p rainforest-ui rainforest-react
perl -e 'alarm 900; exec @ARGV' -- pnpm nx build-storybook rainforest-react --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/rainforest-ui/src/recipes/empty.ts libs/rainforest-ui/src/recipes/index.ts libs/rainforest-ui/src/recipes/recipes.test.ts libs/rainforest-react/src/components/empty.tsx libs/rainforest-react/src/empty.test.tsx libs/rainforest-react/stories/Empty.stories.tsx libs/rainforest-react/src/index.ts libs/rainforest-react/src/contract.test.ts libs/rainforest-react/conventions.md .design-sync/config.json
git commit -m "feat(rainforest-react): add Empty from the shadcn base-nova registry

emptyMediaVariants lives with the other recipes in rainforest-ui.
cn-font-heading becomes font-heading and EmptyDescription is typed as
the div it renders. Errors stay Alert, as conventions.md now says.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 6: Label and Field

**Files:**

- Create: `libs/rainforest-ui/src/recipes/field.ts`
- Create: `libs/rainforest-react/src/components/label.tsx`, `libs/rainforest-react/src/components/field.tsx`
- Create: `libs/rainforest-react/src/field.test.tsx`
- Create: `libs/rainforest-react/stories/Label.stories.tsx`, `libs/rainforest-react/stories/Field.stories.tsx`
- Modify: `libs/rainforest-ui/src/recipes/index.ts`, `libs/rainforest-ui/src/recipes/recipes.test.ts`, `libs/rainforest-react/src/index.ts`, `libs/rainforest-react/src/contract.test.ts`, `libs/rainforest-react/conventions.md`, `.design-sync/config.json`

**Interfaces:**

- Produces: `Label(props: React.ComponentProps<'label'>)`; `FieldSet`, `FieldLegend` (`variant?: 'legend' | 'label'`), `FieldGroup`, `Field` (`orientation?: 'vertical' | 'horizontal' | 'responsive'`, renders `div role="group" data-slot="field" data-orientation`), `FieldContent`, `FieldLabel` (a `Label` with `data-slot="field-label"`), `FieldTitle`, `FieldDescription`, `FieldSeparator`, `FieldError` (`errors?: Array<{ message?: string } | undefined>`, renders `div role="alert" data-slot="field-error"` or nothing); `fieldVariants`; `LabelProps`, `FieldProps`.

- [ ] **Step 1: View the registry items**

Run: `pnpm dlx shadcn@4.21.0 view https://ui.shadcn.com/r/styles/base-nova/label.json https://ui.shadcn.com/r/styles/base-nova/field.json`
Expected: `field` lists `label` and `separator` as registry dependencies; `FieldLabel` carries two `dark:` classes to drop.

- [ ] **Step 2: Write the failing tests**

`libs/rainforest-react/src/field.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Label,
} from './index';

describe('Label', () => {
  it('names the control its htmlFor points at', () => {
    render(
      <>
        <Label htmlFor="note">Note</Label>
        <Input id="note" />
      </>,
    );
    expect(screen.getByLabelText('Note').tagName).toBe('INPUT');
  });
});

describe('Field', () => {
  it('groups a label, its control and a description', () => {
    render(
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="ref">Reference URL</FieldLabel>
          <Input id="ref" />
          <FieldDescription>Optional.</FieldDescription>
        </Field>
      </FieldGroup>,
    );
    const input = screen.getByLabelText('Reference URL');
    const field = input.closest('[data-slot="field"]') as HTMLElement;
    expect(field.getAttribute('role')).toBe('group');
    expect(field.dataset['orientation']).toBe('vertical');
    expect(field.closest('[data-slot="field-group"]')).not.toBeNull();
    expect(screen.getByText('Reference URL').dataset['slot']).toBe(
      'field-label',
    );
  });

  it('shows an explicit error as an alert', () => {
    render(
      <Field data-invalid>
        <FieldError id="ref-error">
          Reference URL must start with http:// or https://
        </FieldError>
      </Field>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.id).toBe('ref-error');
    expect(alert.textContent).toBe(
      'Reference URL must start with http:// or https://',
    );
  });

  it('shows one message for duplicate errors and a list for several', () => {
    const { rerender } = render(
      <FieldError
        errors={[{ message: 'Required' }, { message: 'Required' }]}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Required');
    rerender(
      <FieldError
        errors={[{ message: 'Required' }, { message: 'Too long' }]}
      />,
    );
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['Required', 'Too long']);
  });

  it('renders nothing without errors or children', () => {
    const { container } = render(<FieldError errors={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

In `recipes.test.ts`, add `fieldVariants,` to the imports (after `emptyMediaVariants,`) and:

```ts
it('resolve the Field orientations', () => {
  expect(fieldVariants()).toContain('flex-col');
  expect(fieldVariants({ orientation: 'horizontal' })).toContain('flex-row');
});
```

Add `'Field',` (after `'Empty',`) and `'Label',` (after `'Kbd',`) to `componentNames` in `contract.test.ts`.

- [ ] **Step 3: Run them to verify they fail**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t test -p rainforest-ui rainforest-react --skip-nx-cache`
Expected: FAIL, `fieldVariants`, `Field` and `Label` do not exist.

- [ ] **Step 4: Write the recipe, the components, the exports and the stories**

`libs/rainforest-ui/src/recipes/field.ts`:

```ts
import { cva, type VariantProps } from 'class-variance-authority';

/** Class recipe behind `Field`. */
export const fieldVariants = cva(
  'group/field flex w-full gap-2 data-[invalid=true]:text-destructive',
  {
    variants: {
      orientation: {
        vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
        horizontal:
          'flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
        responsive:
          'flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
      },
    },
    defaultVariants: {
      orientation: 'vertical',
    },
  },
);

export type FieldVariantProps = VariantProps<typeof fieldVariants>;
```

In `recipes/index.ts`, add after `export * from './empty.js';`:

```ts
export * from './field.js';
```

`libs/rainforest-react/src/components/label.tsx`:

```tsx
'use client';

import type * as React from 'react';

import { cn } from '../lib/cn';

/** A control's visible name. Point `htmlFor` at the control, or wrap it. */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- callers pass htmlFor or wrap the control; the rule cannot see through the prop spread
    <label
      data-slot="label"
      className={cn(
        'flex select-none items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };

export type LabelProps = React.ComponentProps<typeof Label>;
```

`libs/rainforest-react/src/components/field.tsx`:

```tsx
'use client';

import {
  type FieldVariantProps,
  fieldVariants,
} from '@rainforest-dev/rainforest-ui/recipes';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Label } from './label';
import { Separator } from './separator';

function FieldSet({ className, ...props }: React.ComponentProps<'fieldset'>) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        'flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3',
        className,
      )}
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = 'legend',
  ...props
}: React.ComponentProps<'legend'> & { variant?: 'legend' | 'label' }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        'mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base',
        className,
      )}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        'group/field-group @container/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4',
        className,
      )}
      {...props}
    />
  );
}

/** One form field: a label, its control, help and an error. Set `data-invalid` when the control is invalid. */
function Field({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<'div'> & FieldVariantProps) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        'group/field-content flex flex-1 flex-col gap-0.5 leading-snug',
        className,
      )}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        'group/field-label peer/field-label has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 flex w-fit gap-2 leading-snug has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border *:data-[slot=field]:p-2.5 group-data-[disabled=true]/field:opacity-50',
        'has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col',
        className,
      )}
      {...props}
    />
  );
}

function FieldTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        'flex w-fit items-center gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        'text-muted-foreground group-has-data-horizontal/field:text-balance text-left text-sm font-normal leading-normal [[data-variant=legend]+&]:-mt-1.5',
        'nth-last-2:-mt-1 last:mt-0',
        '[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4',
        className,
      )}
      {...props}
    />
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        'relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2',
        className,
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="bg-background text-muted-foreground relative mx-auto block w-fit px-2"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<'div'> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = React.useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ];

    if (uniqueErrors.length === 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>,
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn('text-destructive text-sm font-normal', className)}
      {...props}
    >
      {content}
    </div>
  );
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};

export type FieldProps = React.ComponentProps<typeof Field>;

export { fieldVariants };
```

In `libs/rainforest-react/src/index.ts`, add after `export * from './components/empty';`:

```ts
export * from './components/field';
```

and after `export * from './components/kbd';`:

```ts
export * from './components/label';
```

`libs/rainforest-react/stories/Label.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input, Label } from '../src';

const meta = {
  title: 'Forms/Label',
  component: Label,
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex max-w-xs flex-col gap-2">
      <Label htmlFor="label-note">Note</Label>
      <Input id="label-note" />
    </div>
  ),
};

export const Dark: Story = {
  render: Default.render,
  globals: { scheme: 'dark' },
};
```

`libs/rainforest-react/stories/Field.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '../src';

const meta = {
  title: 'Forms/Field',
  component: Field,
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeliveryForm: Story = {
  render: () => (
    <form className="flex w-72 flex-col gap-3">
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="field-ref">Reference URL</FieldLabel>
          <Input id="field-ref" type="url" />
        </Field>
        <Field>
          <FieldLabel htmlFor="field-note">Note</FieldLabel>
          <Input id="field-note" />
        </Field>
      </FieldGroup>
      <Button type="submit" size="sm">
        Save
      </Button>
    </form>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Field data-invalid className="w-72">
      <FieldLabel htmlFor="field-bad-ref">Reference URL</FieldLabel>
      <Input
        id="field-bad-ref"
        type="url"
        defaultValue="ftp://shelf.example"
        aria-invalid
        aria-describedby="field-bad-ref-error"
      />
      <FieldError id="field-bad-ref-error">
        Reference URL must start with http:// or https://
      </FieldError>
    </Field>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <Field orientation="horizontal" className="w-72">
      <Checkbox id="field-daily" defaultChecked />
      <FieldContent>
        <FieldLabel htmlFor="field-daily">Daily digest</FieldLabel>
        <FieldDescription>One email each morning.</FieldDescription>
      </FieldContent>
    </Field>
  ),
};

export const Dark: Story = {
  render: DeliveryForm.render,
  globals: { scheme: 'dark' },
};
```

In `.design-sync/config.json`, insert after the new `"Empty"` entry:

```json
    "Field": {
      "skip": ["forms-field--dark"]
    },
```

and after the `"Kbd"` entry:

```json
    "Label": {
      "skip": ["forms-label--dark"]
    },
```

In `conventions.md`, append to `## Composition`:

```markdown
- A form field is `Field` with a `FieldLabel` pointing at the control (`htmlFor`), optional
  `FieldDescription` and a `FieldError` whose `id` the control lists in `aria-describedby`. Set
  `data-invalid` on the `Field` and `aria-invalid` on the control together. Stack fields in
  `FieldGroup`.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t test -p rainforest-ui rainforest-react --skip-nx-cache`
Expected: PASS.

- [ ] **Step 6: Lint, typecheck, Storybook build**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck -p rainforest-ui rainforest-react
perl -e 'alarm 900; exec @ARGV' -- pnpm nx build-storybook rainforest-react --skip-nx-cache
```

Expected: PASS. An "unused eslint-disable directive" warning on `label.tsx` means the rule does not fire through the spread in this version; delete that comment line and rerun lint.

- [ ] **Step 7: Commit**

```bash
git add libs/rainforest-ui/src/recipes/field.ts libs/rainforest-ui/src/recipes/index.ts libs/rainforest-ui/src/recipes/recipes.test.ts libs/rainforest-react/src/components/label.tsx libs/rainforest-react/src/components/field.tsx libs/rainforest-react/src/field.test.tsx libs/rainforest-react/stories/Label.stories.tsx libs/rainforest-react/stories/Field.stories.tsx libs/rainforest-react/src/index.ts libs/rainforest-react/src/contract.test.ts libs/rainforest-react/conventions.md .design-sync/config.json
git commit -m "feat(rainforest-react): add Field and its Label from the shadcn base-nova registry

Label comes in as Field's registry dependency. fieldVariants joins the
recipes; FieldLabel drops its dark: classes and FieldError compares with
===. Stories cover the delivery form, an invalid field and the
horizontal layout.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 7: ButtonGroup

**Files:**

- Create: `libs/rainforest-ui/src/recipes/button-group.ts`
- Create: `libs/rainforest-react/src/components/button-group.tsx`
- Create: `libs/rainforest-react/src/button-group.test.tsx`
- Create: `libs/rainforest-react/stories/ButtonGroup.stories.tsx`
- Modify: `libs/rainforest-ui/src/recipes/index.ts`, `libs/rainforest-ui/src/recipes/recipes.test.ts`, `libs/rainforest-react/src/index.ts`, `libs/rainforest-react/src/contract.test.ts`, `libs/rainforest-react/conventions.md`, `.design-sync/config.json`

**Interfaces:**

- Produces: `ButtonGroup` (`orientation?: 'horizontal' | 'vertical'`, renders `div role="group" data-slot="button-group"`), `ButtonGroupText` (Base UI `render` prop, `data-slot="button-group-text"`), `ButtonGroupSeparator` (vertical `Separator` by default); `buttonGroupVariants`; `ButtonGroupProps`.

- [ ] **Step 1: View the registry item**

Run: `pnpm dlx shadcn@4.21.0 view https://ui.shadcn.com/r/styles/base-nova/button-group.json`
Expected: `buttonGroupVariants`, `useRender` and `mergeProps` from `@base-ui/react`, a `separator` registry dependency.

- [ ] **Step 2: Write the failing tests**

`libs/rainforest-react/src/button-group.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import {
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from './index';

describe('ButtonGroup', () => {
  it('is a group that joins its children', () => {
    render(
      <ButtonGroup aria-label="Sort">
        <Button variant="outline">Title</Button>
        <Button variant="outline" aria-label="Sort direction: ascending">
          ↑
        </Button>
      </ButtonGroup>,
    );
    const group = screen.getByRole('group', { name: 'Sort' });
    expect(group.dataset['slot']).toBe('button-group');
    expect(group.className).toContain(
      '[&>[data-slot]~[data-slot]]:rounded-l-none',
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('stacks vertically', () => {
    render(
      <ButtonGroup aria-label="Zoom" orientation="vertical">
        <Button>+</Button>
        <Button>−</Button>
      </ButtonGroup>,
    );
    const group = screen.getByRole('group', { name: 'Zoom' });
    expect(group.dataset['orientation']).toBe('vertical');
    expect(group.className).toContain('flex-col');
  });

  it('renders its text part as another element through render', () => {
    render(
      <ButtonGroup aria-label="Query">
        <ButtonGroupText render={<span />}>https://</ButtonGroupText>
        <Button>Go</Button>
      </ButtonGroup>,
    );
    const text = screen.getByText('https://');
    expect(text.tagName).toBe('SPAN');
    expect(text.dataset['slot']).toBe('button-group-text');
  });

  it('draws a vertical separator between items', () => {
    render(
      <ButtonGroup aria-label="Clipboard">
        <Button>Copy</Button>
        <ButtonGroupSeparator />
        <Button>Paste</Button>
      </ButtonGroup>,
    );
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe(
      'vertical',
    );
  });
});
```

In `recipes.test.ts`, add `buttonGroupVariants,` to the imports (after `badgeVariants,`) and:

```ts
it('resolve the ButtonGroup orientations', () => {
  expect(buttonGroupVariants()).toContain('rounded-r-none');
  expect(buttonGroupVariants({ orientation: 'vertical' })).toContain(
    'flex-col',
  );
});
```

Add `'ButtonGroup',` to `componentNames` in `contract.test.ts` (after `'Button',`).

- [ ] **Step 3: Run them to verify they fail**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t test -p rainforest-ui rainforest-react --skip-nx-cache`
Expected: FAIL, `buttonGroupVariants` and `ButtonGroup` do not exist.

- [ ] **Step 4: Write the recipe, the component, the exports and the story**

`libs/rainforest-ui/src/recipes/button-group.ts`:

```ts
import { cva, type VariantProps } from 'class-variance-authority';

/** Class recipe behind `ButtonGroup`. */
export const buttonGroupVariants = cva(
  "flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-lg [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
  {
    variants: {
      orientation: {
        horizontal:
          '*:data-slot:rounded-r-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-lg! [&>[data-slot]~[data-slot]]:rounded-l-none [&>[data-slot]~[data-slot]]:border-l-0',
        vertical:
          'flex-col *:data-slot:rounded-b-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-lg! [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  },
);

export type ButtonGroupVariantProps = VariantProps<typeof buttonGroupVariants>;
```

In `recipes/index.ts`, add after `export * from './button.js';`:

```ts
export * from './button-group.js';
```

`libs/rainforest-react/src/components/button-group.tsx`:

```tsx
'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import {
  type ButtonGroupVariantProps,
  buttonGroupVariants,
} from '@rainforest-dev/rainforest-ui/recipes';
import type * as React from 'react';

import { cn } from '../lib/cn';
import { Separator } from './separator';

/** Joins controls that act as one, such as a select and its action, into a single bordered group. */
function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<'div'> & ButtonGroupVariantProps) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

function ButtonGroupText({
  className,
  render,
  ...props
}: useRender.ComponentProps<'div'>) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(
          "bg-muted flex items-center gap-2 rounded-lg border px-2.5 text-sm font-medium [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
          className,
        ),
      },
      props,
    ),
    render,
    state: {
      slot: 'button-group-text',
    },
  });
}

function ButtonGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        'bg-input data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto relative self-stretch',
        className,
      )}
      {...props}
    />
  );
}

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText };

export type ButtonGroupProps = React.ComponentProps<typeof ButtonGroup>;

export { buttonGroupVariants };
```

In `libs/rainforest-react/src/index.ts`, add after `export * from './components/button';`:

```ts
export * from './components/button-group';
```

`libs/rainforest-react/stories/ButtonGroup.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowUpIcon, DownloadIcon } from 'lucide-react';

import {
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../src';

const SORTS = [
  { value: 'title', label: 'Title' },
  { value: 'added', label: 'Date added' },
];

const meta = {
  title: 'Actions/ButtonGroup',
  component: ButtonGroup,
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SortControl: Story = {
  render: () => (
    <ButtonGroup>
      <Select items={SORTS} defaultValue="title">
        <SelectTrigger size="sm" aria-label="Sort">
          <span className="text-muted-foreground text-xs">Sort</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Sort direction: ascending"
      >
        <ArrowUpIcon aria-hidden />
      </Button>
    </ButtonGroup>
  ),
};

export const SelectAndAction: Story = {
  render: () => (
    <ButtonGroup>
      <Select items={[{ value: 'EPUB', label: 'EPUB' }]} defaultValue="EPUB">
        <SelectTrigger size="sm" aria-label="Download format">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="EPUB">EPUB</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm">
        <DownloadIcon aria-hidden />
        ZIP
      </Button>
    </ButtonGroup>
  ),
};

export const WithText: Story = {
  render: () => (
    <ButtonGroup className="w-80">
      <ButtonGroupText>https://</ButtonGroupText>
      <Input aria-label="Feed URL" placeholder="example.com/rss.xml" />
      <ButtonGroupSeparator />
      <Button variant="outline">Validate</Button>
    </ButtonGroup>
  ),
};

export const Dark: Story = {
  render: SortControl.render,
  globals: { scheme: 'dark' },
};
```

In `.design-sync/config.json`, insert after the `"Button"` entry:

```json
    "ButtonGroup": {
      "skip": ["actions-buttongroup--dark"]
    },
```

In `conventions.md`, append to `## Composition`:

```markdown
- `ButtonGroup` joins controls that act as one: a `SelectTrigger` and the button that applies
  it, or an input and its action. A single-choice switch (views, modes) is `ToggleGroup`.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t test -p rainforest-ui rainforest-react --skip-nx-cache`
Expected: PASS.

- [ ] **Step 6: Lint, typecheck, Storybook build**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck -p rainforest-ui rainforest-react
perl -e 'alarm 900; exec @ARGV' -- pnpm nx build-storybook rainforest-react --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/rainforest-ui/src/recipes/button-group.ts libs/rainforest-ui/src/recipes/index.ts libs/rainforest-ui/src/recipes/recipes.test.ts libs/rainforest-react/src/components/button-group.tsx libs/rainforest-react/src/button-group.test.tsx libs/rainforest-react/stories/ButtonGroup.stories.tsx libs/rainforest-react/src/index.ts libs/rainforest-react/src/contract.test.ts libs/rainforest-react/conventions.md .design-sync/config.json
git commit -m "feat(rainforest-react): add ButtonGroup from the shadcn base-nova registry

buttonGroupVariants joins the recipes. ButtonGroupText calls useRender,
so the file is a client module. Stories show the sort control and a
select with its action.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 8: Item

**Files:**

- Create: `libs/rainforest-ui/src/recipes/item.ts`
- Create: `libs/rainforest-react/src/components/item.tsx`
- Create: `libs/rainforest-react/src/item.test.tsx`
- Create: `libs/rainforest-react/stories/Item.stories.tsx`
- Modify: `libs/rainforest-ui/src/recipes/index.ts`, `libs/rainforest-ui/src/recipes/recipes.test.ts`, `libs/rainforest-react/src/index.ts`, `libs/rainforest-react/src/contract.test.ts`, `libs/rainforest-react/conventions.md`, `.design-sync/config.json`

**Interfaces:**

- Produces: `ItemGroup` (`div role="list" data-slot="item-group"`), `Item` (`variant?: 'default' | 'outline' | 'muted'`, `size?: 'default' | 'sm' | 'xs'`, Base UI `render` prop, sets `data-slot="item"`, `data-variant`, `data-size`), `ItemMedia` (`variant?: 'default' | 'icon' | 'image'`), `ItemContent`, `ItemTitle`, `ItemDescription` (`p`), `ItemActions`, `ItemHeader`, `ItemFooter`, `ItemSeparator`; `itemVariants`, `itemMediaVariants`; `ItemProps`. Callers inside `ItemGroup` pass `role="listitem"` to each `Item`.

- [ ] **Step 1: View the registry item**

Run: `pnpm dlx shadcn@4.21.0 view https://ui.shadcn.com/r/styles/base-nova/item.json`
Expected: `itemVariants`, `itemMediaVariants`, `useRender` in `Item`, a `separator` registry dependency, and no role on `Item`.

- [ ] **Step 2: Write the failing tests**

`libs/rainforest-react/src/item.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import {
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from './index';

describe('Item', () => {
  it('forms a list when each item takes role listitem', () => {
    render(
      <ItemGroup aria-label="Deliveries">
        <Item role="listitem" data-platform="kobo">
          <ItemContent>
            <ItemTitle>
              Kobo
              <Badge variant="muted">Not added</Badge>
            </ItemTitle>
          </ItemContent>
          <ItemActions>
            <Button size="xs">Mark added</Button>
          </ItemActions>
        </Item>
        <Item role="listitem" size="sm" data-platform="notebooklm">
          <ItemContent>
            <ItemTitle>NotebookLM</ItemTitle>
          </ItemContent>
        </Item>
      </ItemGroup>,
    );
    const list = screen.getByRole('list', { name: 'Deliveries' });
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.dataset['slot']).toBe('item');
    expect(rows[0]?.dataset['size']).toBe('default');
    expect(rows[1]?.dataset['size']).toBe('sm');
    expect(
      list.contains(screen.getByRole('button', { name: 'Mark added' })),
    ).toBe(true);
  });

  it('renders as a link through render and keeps its variant', () => {
    render(
      <Item variant="outline" render={<a href="/books/38" />}>
        <ItemContent>
          <ItemTitle>Harbor Lights</ItemTitle>
          <ItemDescription>Mira Okafor</ItemDescription>
        </ItemContent>
      </Item>,
    );
    const link = screen.getByRole('link', { name: /Harbor Lights/ });
    expect(link.getAttribute('href')).toBe('/books/38');
    expect(link.dataset['variant']).toBe('outline');
    expect(link.className).toContain('border-border');
    expect(screen.getByText('Mira Okafor').tagName).toBe('P');
  });

  it('marks image media', () => {
    const { container } = render(
      <Item>
        <ItemMedia variant="image">
          <img src="/cover.jpg" alt="" />
        </ItemMedia>
      </Item>,
    );
    expect(
      container
        .querySelector('[data-slot="item-media"]')
        ?.getAttribute('data-variant'),
    ).toBe('image');
  });
});
```

In `recipes.test.ts`, add `itemMediaVariants,` and `itemVariants,` to the imports (after `inputGroupButtonVariants,`) and:

```ts
it('resolve the Item variants', () => {
  expect(itemVariants({ variant: 'outline' })).toContain('border-border');
  expect(itemVariants({ variant: 'muted' })).toContain('bg-muted/50');
  expect(itemMediaVariants({ variant: 'image' })).toContain('size-10');
});
```

Add `'Item',` to `componentNames` in `contract.test.ts` (after `'InputGroup',`).

- [ ] **Step 3: Run them to verify they fail**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t test -p rainforest-ui rainforest-react --skip-nx-cache`
Expected: FAIL, `itemVariants` and `Item` do not exist.

- [ ] **Step 4: Write the recipe, the component, the exports and the story**

`libs/rainforest-ui/src/recipes/item.ts`:

```ts
import { cva, type VariantProps } from 'class-variance-authority';

/** Class recipe behind `Item`. */
export const itemVariants = cva(
  'group/item flex w-full flex-wrap items-center rounded-lg border text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted',
  {
    variants: {
      variant: {
        default: 'border-transparent',
        outline: 'border-border',
        muted: 'border-transparent bg-muted/50',
      },
      size: {
        default: 'gap-2.5 px-3 py-2.5',
        sm: 'gap-2.5 px-3 py-2.5',
        xs: 'gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

/** Class recipe behind `ItemMedia`. */
export const itemMediaVariants = cva(
  'flex shrink-0 items-center justify-center gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start [&_svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: "[&_svg:not([class*='size-'])]:size-4",
        image:
          'size-10 overflow-hidden rounded-sm group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type ItemVariantProps = VariantProps<typeof itemVariants>;
export type ItemMediaVariantProps = VariantProps<typeof itemMediaVariants>;
```

In `recipes/index.ts`, add after `export * from './input-group.js';`:

```ts
export * from './item.js';
```

`libs/rainforest-react/src/components/item.tsx`:

```tsx
'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import {
  type ItemMediaVariantProps,
  itemMediaVariants,
  type ItemVariantProps,
  itemVariants,
} from '@rainforest-dev/rainforest-ui/recipes';
import type * as React from 'react';

import { cn } from '../lib/cn';
import { Separator } from './separator';

function ItemGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn(
        'group/item-group has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2 flex w-full flex-col gap-4',
        className,
      )}
      {...props}
    />
  );
}

function ItemSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn('my-2', className)}
      {...props}
    />
  );
}

/** A list row with media, a title and description, and actions. Inside ItemGroup, pass role="listitem". */
function Item({
  className,
  variant = 'default',
  size = 'default',
  render,
  ...props
}: useRender.ComponentProps<'div'> & ItemVariantProps) {
  return useRender({
    defaultTagName: 'div',
    props: mergeProps<'div'>(
      {
        className: cn(itemVariants({ variant, size, className })),
      },
      props,
    ),
    render,
    state: {
      slot: 'item',
      variant,
      size,
    },
  });
}

function ItemMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & ItemMediaVariantProps) {
  return (
    <div
      data-slot="item-media"
      data-variant={variant}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-content"
      className={cn(
        'flex flex-1 flex-col gap-1 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none',
        className,
      )}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-title"
      className={cn(
        'line-clamp-1 flex w-fit items-center gap-2 text-sm font-medium leading-snug underline-offset-4',
        className,
      )}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        'text-muted-foreground [&>a:hover]:text-primary line-clamp-2 text-left text-sm font-normal leading-normal group-data-[size=xs]/item:text-xs [&>a]:underline [&>a]:underline-offset-4',
        className,
      )}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-actions"
      className={cn('flex items-center gap-2', className)}
      {...props}
    />
  );
}

function ItemHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-header"
      className={cn(
        'flex basis-full items-center justify-between gap-2',
        className,
      )}
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="item-footer"
      className={cn(
        'flex basis-full items-center justify-between gap-2',
        className,
      )}
      {...props}
    />
  );
}

export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
};

export type ItemProps = React.ComponentProps<typeof Item>;

export { itemMediaVariants, itemVariants };
```

In `libs/rainforest-react/src/index.ts`, add after `export * from './components/input-group';`:

```ts
export * from './components/item';
```

`libs/rainforest-react/stories/Item.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckIcon, XIcon } from 'lucide-react';

import {
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '../src';

const meta = {
  title: 'Display/Item',
  component: Item,
} satisfies Meta<typeof Item>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeliveryRows: Story = {
  render: () => (
    <ItemGroup className="w-96 gap-0 divide-y rounded-lg border">
      <Item role="listitem" className="rounded-none py-2">
        <ItemContent>
          <ItemTitle>
            Kobo
            <Badge variant="success">
              <CheckIcon aria-hidden />
              2026-09-01
            </Badge>
          </ItemTitle>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="xs">
            Log again
          </Button>
        </ItemActions>
      </Item>
      <Item role="listitem" className="rounded-none py-2">
        <ItemContent>
          <ItemTitle>
            NotebookLM
            <Badge variant="muted">Not added</Badge>
          </ItemTitle>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="xs">
            Mark added
          </Button>
        </ItemActions>
      </Item>
    </ItemGroup>
  ),
};

export const HistoryEntry: Story = {
  render: () => (
    <ItemGroup className="w-96 gap-2">
      <Item
        role="listitem"
        variant="outline"
        className="items-start px-2.5 py-2"
      >
        <ItemContent className="min-w-0">
          <ItemTitle>
            Kobo
            <span className="text-muted-foreground font-mono text-xs font-normal">
              2026-09-01 09:30
            </span>
          </ItemTitle>
          <ItemDescription>first read</ItemDescription>
          <ItemDescription className="truncate">
            <a href="https://shelf.example.com/41">
              https://shelf.example.com/41
            </a>
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="ghost" size="icon-xs" aria-label="Remove Kobo event">
            <XIcon aria-hidden />
          </Button>
        </ItemActions>
      </Item>
    </ItemGroup>
  ),
};

export const AsLink: Story = {
  render: () => (
    <Item
      variant="outline"
      className="w-96"
      render={<a href="#harbor-lights" />}
    >
      <ItemContent>
        <ItemTitle>Harbor Lights</ItemTitle>
        <ItemDescription>Mira Okafor · EPUB</ItemDescription>
      </ItemContent>
    </Item>
  ),
};

export const Dark: Story = {
  render: DeliveryRows.render,
  globals: { scheme: 'dark' },
};
```

In `.design-sync/config.json`, insert after the `"InputGroup"` entry:

```json
    "Item": {
      "skip": ["display-item--dark"]
    },
```

In `conventions.md`, append to `## Composition`:

```markdown
- List rows with a title, meta and actions are `Item`s inside `ItemGroup`. `ItemGroup` is
  `role="list"`, so give each `Item` `role="listitem"`; axe reports the list otherwise.
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t test -p rainforest-ui rainforest-react --skip-nx-cache`
Expected: PASS.

- [ ] **Step 6: Lint, typecheck, Storybook build**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck -p rainforest-ui rainforest-react
perl -e 'alarm 900; exec @ARGV' -- pnpm nx build-storybook rainforest-react --skip-nx-cache
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/rainforest-ui/src/recipes/item.ts libs/rainforest-ui/src/recipes/index.ts libs/rainforest-ui/src/recipes/recipes.test.ts libs/rainforest-react/src/components/item.tsx libs/rainforest-react/src/item.test.tsx libs/rainforest-react/stories/Item.stories.tsx libs/rainforest-react/src/index.ts libs/rainforest-react/src/contract.test.ts libs/rainforest-react/conventions.md .design-sync/config.json
git commit -m "feat(rainforest-react): add Item from the shadcn base-nova registry

itemVariants and itemMediaVariants join the recipes. ItemGroup is a
role=list, so callers give each Item role=listitem; conventions.md and
the stories say so.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 9: Calibre SelectMark becomes the lib Checkbox

**Files:**

- Modify: `apps/personal-calibre/src/components/views/SelectMark.tsx` (whole file)
- Test: `apps/personal-calibre-e2e/src/keyboard.spec.ts`

**Interfaces:**

- Consumes: lib `Checkbox` (Base UI root: `checked`, `onCheckedChange`, `tabIndex`, `data-checked` when checked).
- Produces: `SelectMark({ checked, visible, onToggle, className })`, unchanged signature; the root keeps `data-select-mark`.

- [ ] **Step 1: Write the failing e2e tests**

In `apps/personal-calibre-e2e/src/keyboard.spec.ts`, inside `test.describe('shelf keyboard', …)`, after the `has one tab stop` test, add:

```ts
test('the select mark is the lib Checkbox, toggles on click and adds no tab stop', async ({
  page,
}) => {
  await gotoLibrary(page);
  const first = options(page).first();
  await expect(first).toBeVisible();
  const mark = first.locator('[data-select-mark]');
  await expect(mark).toHaveAttribute('data-slot', 'checkbox');
  await expect(mark).toHaveAttribute('tabindex', '-1');
  await expect(mark).toHaveAttribute('aria-hidden', 'true');
  await first.hover();
  await mark.click();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await expect(first).toBeFocused();
  await expect(page).not.toHaveURL(/book=/);
  await mark.click();
  await expect(first).toHaveAttribute('aria-selected', 'false');
  await page.keyboard.press('x');
  await expect(first).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-selected', 'false');
  await expect(
    page.locator('[data-select-mark]:not([tabindex="-1"])'),
  ).toHaveCount(0);
});
```

In `test.describe('grouped shelf keyboard', …)`, `keeps exactly one tab stop across every group`, add as the last line:

```ts
await expect(
  shelf.locator('[data-select-mark]:not([tabindex="-1"])'),
).toHaveCount(0);
```

- [ ] **Step 2: Run them to verify the new test fails**

```bash
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 900; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- --grep "select mark is the lib Checkbox|keeps exactly one tab stop"
```

Expected: `the select mark is the lib Checkbox…` FAILS on `data-slot` (the old mark is a plain span); `keeps exactly one tab stop` PASSES.

- [ ] **Step 3: Replace SelectMark**

`apps/personal-calibre/src/components/views/SelectMark.tsx`:

```tsx
'use client';

import { Checkbox } from '@rainforest-dev/rainforest-react';

import { cn } from '@/lib/utils';

export function SelectMark({
  checked,
  visible,
  onToggle,
  className,
}: {
  checked: boolean;
  visible: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Checkbox
      aria-hidden
      tabIndex={-1}
      data-select-mark=""
      checked={checked}
      onCheckedChange={() => onToggle()}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        event.currentTarget.closest<HTMLElement>('[role="option"]')?.focus();
      }}
      className={cn(
        'bg-background/90 size-5 cursor-pointer transition-opacity',
        visible || checked
          ? 'opacity-100'
          : 'opacity-0 group-hover/tile:opacity-100 group-focus-visible/tile:opacity-100',
        className,
      )}
    />
  );
}
```

`BookTile.tsx` does not change: it already passes `checked`, `visible`, `onToggle` and `className="absolute left-1.5 top-1.5"`, and `cn` resolves `absolute` over the Checkbox's `relative`.

- [ ] **Step 4: Run the keyboard, shelf, phone, bulk and a11y specs**

```bash
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 1200; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- src/keyboard.spec.ts src/shelf.spec.ts src/bulk.spec.ts src/a11y.spec.ts src/shortcuts.spec.ts
perl -e 'alarm 900; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- --project=phone src/library.phone.spec.ts src/a11y.phone.spec.ts
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
```

Expected: PASS, including `focus is foreground and selection is primary` (the checked Checkbox paints `bg-primary`).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck -p personal-calibre personal-calibre-e2e
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/components/views/SelectMark.tsx apps/personal-calibre-e2e/src/keyboard.spec.ts
git commit -m "refactor(personal-calibre): draw the tile select mark with the lib Checkbox

The mark keeps its hover and select-mode visibility and stays hidden from
assistive tech, since the option tile carries the name and
aria-selected. tabIndex -1 keeps the Shelf at one Tab stop, and a click
focuses the tile rather than the box so roving focus stays in step.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 10: Calibre empty result and key hints

`LoadError.tsx` does not change (spec: it stays an `Alert`).

**Files:**

- Modify: `apps/personal-calibre/src/components/library/EmptyResult.tsx` (whole file)
- Modify: `apps/personal-calibre/src/components/library/KeyHints.tsx` (whole file)
- Test: `apps/personal-calibre-e2e/src/shelf.spec.ts`, `apps/personal-calibre-e2e/src/shortcuts.spec.ts`

**Interfaces:**

- Consumes: `Empty`, `EmptyContent`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle` (Task 5); `Kbd`, `KbdGroup`.

- [ ] **Step 1: Write the failing e2e assertions**

In `shelf.spec.ts`, test `an empty result offers Clear filters`, after the `No books match these filters.` assertion add:

```ts
await expect(
  page.locator('[data-view-region] [data-slot="empty"]'),
).toBeVisible();
```

In `shortcuts.spec.ts`, in the test containing `await expect(page.locator('[data-key-hints]')).toContainText('Page');`, add right after that line:

```ts
await expect(
  page.locator('[data-key-hints] [data-slot="kbd-group"]').first(),
).toBeVisible();
```

- [ ] **Step 2: Run them to verify they fail**

```bash
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 900; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- src/shelf.spec.ts src/shortcuts.spec.ts
```

Expected: both new assertions FAIL (no `empty` slot, no `kbd-group` slot).

- [ ] **Step 3: Write the components**

`apps/personal-calibre/src/components/library/EmptyResult.tsx`:

```tsx
'use client';

import {
  Button,
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@rainforest-dev/rainforest-react';
import { SearchX } from 'lucide-react';

import { useLibrary } from './LibraryProvider';

export function EmptyResult({ filtered }: { filtered: boolean }) {
  const { clearFilters } = useLibrary();
  return (
    <Empty className="py-20">
      <EmptyHeader>
        {filtered && (
          <EmptyMedia variant="icon">
            <SearchX aria-hidden />
          </EmptyMedia>
        )}
        <EmptyTitle>
          {filtered
            ? 'No books match these filters.'
            : 'No books in this library yet.'}
        </EmptyTitle>
      </EmptyHeader>
      {filtered && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
```

`apps/personal-calibre/src/components/library/KeyHints.tsx`:

```tsx
'use client';

import { Kbd, KbdGroup } from '@rainforest-dev/rainforest-react';

import { hintsFor } from '@/lib/keyboard';

import { useLibrary } from './LibraryProvider';

export function KeyHints() {
  const { view, pageInfo } = useLibrary();
  return (
    <div
      data-key-hints
      className="bg-background text-muted-foreground sticky bottom-0 z-10 hidden flex-wrap items-center gap-x-4 gap-y-1 border-t py-2 text-xs lg:flex"
    >
      {hintsFor(view, pageInfo.pageCount > 1).map((hint) => (
        <span key={hint.label} className="inline-flex items-center gap-1">
          <KbdGroup>
            {hint.keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
          {hint.label}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the specs to verify they pass**

```bash
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 900; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- src/shelf.spec.ts src/shortcuts.spec.ts src/a11y.spec.ts src/states.spec.ts
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
```

Expected: PASS, including `empty result has no axe violations` and both LoadError states tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck -p personal-calibre personal-calibre-e2e
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/components/library/EmptyResult.tsx apps/personal-calibre/src/components/library/KeyHints.tsx apps/personal-calibre-e2e/src/shelf.spec.ts apps/personal-calibre-e2e/src/shortcuts.spec.ts
git commit -m "refactor(personal-calibre): build the empty result with Empty and group hint keys

EmptyResult uses the lib Empty with the same copy and Clear filters
action, and KeyHints wraps each hint's keys in KbdGroup. LoadError stays
an Alert so a failure is still announced.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 11: Calibre delivery rows with Item, Field and Spinner

**Files:**

- Modify: `apps/personal-calibre/src/components/detail/DeliveryRows.tsx` (whole file)
- Test: `apps/personal-calibre-e2e/src/deliveries.spec.ts`

**Interfaces:**

- Consumes: `Item`, `ItemGroup`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions` (Task 8); `Field`, `FieldGroup`, `FieldLabel`, `FieldError` (Task 6); `Spinner` (Task 4).
- Produces: `DeliveryRows({ bookId, platforms, events, headingAs })`, unchanged signature; each platform row keeps `data-platform`.

- [ ] **Step 1: Write the failing e2e tests**

In `deliveries.spec.ts`, test `Mark added shows at once, with URL and note in History`:

after `await expect(row(page, 'kobo')).toContainText('Not added');` add:

```ts
await expect(row(page, 'kobo')).toHaveAttribute('data-slot', 'item');
await expect(row(page, 'kobo')).toHaveAttribute('role', 'listitem');
```

after the `Reference URL must start with http:// or https://` assertion add:

```ts
const errorId = await dialog
  .getByLabel('Reference URL')
  .getAttribute('aria-describedby');
await expect(dialog.locator(`[id="${errorId}"]`)).toHaveAttribute(
  'data-slot',
  'field-error',
);
await expect(dialog.locator(`[id="${errorId}"]`)).toHaveAttribute(
  'role',
  'alert',
);
```

Add a new test inside `test.describe('deliveries', …)`:

```ts
test('Save shows a spinner and stays disabled while the request runs', async ({
  page,
}) => {
  await gotoLibrary(page, '/?book=42');
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/books/42/deliveries', async (route) => {
    if (route.request().method() === 'POST') await held;
    await route.continue();
  });
  await row(page, 'notebooklm')
    .getByRole('button', { name: 'Mark added' })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Mark as added to NotebookLM',
  });
  await expect(dialog.locator('[data-slot="field"]')).toHaveCount(2);
  const save = dialog.getByRole('button', { name: 'Save' });
  await save.click();
  await expect(save).toBeDisabled();
  await expect(save.locator('[data-slot="spinner"]')).toBeVisible();
  release();
  await expect(page.getByText('Logged NotebookLM')).toBeVisible();
  await expect(row(page, 'notebooklm')).toContainText(today());
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 900; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- src/deliveries.spec.ts
```

Expected: FAIL on `data-slot` `item`, on `field-error`, and on the `field` count.

- [ ] **Step 3: Rewrite DeliveryRows**

`apps/personal-calibre/src/components/detail/DeliveryRows.tsx`:

```tsx
'use client';

import {
  Badge,
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  Spinner,
  toast,
} from '@rainforest-dev/rainforest-react';
import { Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import {
  formatDeliveryDate,
  formatDeliveryTime,
  latestByPlatform,
} from '@/lib/deliveries';
import { safeExternalHref } from '@/lib/url';
import type { BookDeliveryEvent, DeliveryPlatform } from '@/types/delivery';

interface Props {
  bookId: number;
  platforms: DeliveryPlatform[];
  events: BookDeliveryEvent[];
  headingAs: 'h2' | 'h3';
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function DeliveryRows({
  bookId,
  platforms,
  events,
  headingAs: Heading,
}: Props) {
  const headingId = useId();
  const latest = latestByPlatform(events);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <Heading
        id={headingId}
        className="text-muted-foreground text-xs font-medium uppercase tracking-wide"
      >
        Deliveries
      </Heading>
      <ItemGroup className="gap-0 divide-y rounded-lg border">
        {platforms.map((platform) => (
          <DeliveryRow
            key={platform.key}
            bookId={bookId}
            platform={platform}
            latest={latest.get(platform.key) ?? null}
          />
        ))}
      </ItemGroup>
      {events.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer select-none">
            History ({events.length})
          </summary>
          <ItemGroup className="mt-2 gap-2">
            {events.map((event) => (
              <HistoryItem key={event.id} bookId={bookId} event={event} />
            ))}
          </ItemGroup>
        </details>
      )}
    </section>
  );
}

function DeliveryRow({
  bookId,
  platform,
  latest,
}: {
  bookId: number;
  platform: DeliveryPlatform;
  latest: BookDeliveryEvent | null;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [externalRef, setExternalRef] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  async function save() {
    const trimmedRef = externalRef.trim();
    if (trimmedRef && !safeExternalHref(trimmedRef)) {
      setRefError('Reference URL must start with http:// or https://');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${bookId}/deliveries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ platformKey: platform.key, note, externalRef }),
      });
      if (!res.ok)
        throw new Error(await readError(res, 'Failed to add delivery event'));
      toast.success(`Logged ${platform.name}`);
      setOpen(false);
      setNote('');
      setExternalRef('');
      setRefError(null);
      router.refresh();
    } catch (error) {
      toast.error(`Delivery failed — ${messageOf(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Item
      role="listitem"
      data-platform={platform.key}
      className="rounded-none py-2"
    >
      <ItemContent>
        <ItemTitle>
          {platform.name}
          {latest ? (
            <Badge variant="success">
              <Check aria-hidden />
              {formatDeliveryDate(latest.addedAt)}
            </Badge>
          ) : (
            <Badge variant="muted">Not added</Badge>
          )}
        </ItemTitle>
      </ItemContent>
      <ItemActions>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button variant="outline" size="xs" />}>
            {latest ? 'Log again' : 'Mark added'}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <PopoverHeader>
              <PopoverTitle>Mark as added to {platform.name}</PopoverTitle>
              <PopoverDescription>
                Logs today&apos;s date. Both fields are optional.
              </PopoverDescription>
            </PopoverHeader>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <FieldGroup className="gap-3">
                <Field data-invalid={refError ? true : undefined}>
                  <FieldLabel htmlFor={`${fieldId}-ref`}>
                    Reference URL
                  </FieldLabel>
                  <Input
                    id={`${fieldId}-ref`}
                    name="externalRef"
                    type="url"
                    value={externalRef}
                    aria-invalid={refError ? true : undefined}
                    aria-describedby={
                      refError ? `${fieldId}-ref-error` : undefined
                    }
                    onChange={(e) => {
                      setExternalRef(e.target.value);
                      if (refError) setRefError(null);
                    }}
                  />
                  {refError && (
                    <FieldError id={`${fieldId}-ref-error`}>
                      {refError}
                    </FieldError>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${fieldId}-note`}>Note</FieldLabel>
                  <Input
                    id={`${fieldId}-note`}
                    name="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
              </FieldGroup>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                Save
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </ItemActions>
    </Item>
  );
}

function HistoryItem({
  bookId,
  event,
}: {
  bookId: number;
  event: BookDeliveryEvent;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const externalHref = safeExternalHref(event.externalRef);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/books/${bookId}/deliveries?deliveryId=${event.id}`,
        {
          method: 'DELETE',
        },
      );
      if (!res.ok)
        throw new Error(
          await readError(res, 'Failed to delete delivery event'),
        );
      router.refresh();
    } catch (error) {
      toast.error(`Delivery failed — ${messageOf(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Item role="listitem" variant="outline" className="items-start px-2.5 py-2">
      <ItemContent className="min-w-0">
        <ItemTitle>
          {event.platformName}
          <span className="text-muted-foreground font-mono text-xs font-normal">
            {formatDeliveryTime(event.addedAt)}
          </span>
        </ItemTitle>
        {event.note && <ItemDescription>{event.note}</ItemDescription>}
        {event.externalRef && (
          <ItemDescription className="truncate">
            {externalHref ? (
              <a href={externalHref} target="_blank" rel="noreferrer noopener">
                {event.externalRef}
              </a>
            ) : (
              event.externalRef
            )}
          </ItemDescription>
        )}
      </ItemContent>
      <ItemActions>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${event.platformName} event`}
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? <Spinner /> : <X aria-hidden />}
        </Button>
      </ItemActions>
    </Item>
  );
}
```

- [ ] **Step 4: Run the specs to verify they pass**

```bash
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 1200; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- src/deliveries.spec.ts src/shelf.spec.ts src/pane.spec.ts src/a11y.spec.ts
perl -e 'alarm 900; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- --project=phone src/a11y.phone.spec.ts
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
```

Expected: PASS, including `the add-delivery form has no axe violations` and `the tile shows a new mark after Mark added in the pane`.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck -p personal-calibre personal-calibre-e2e
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/components/detail/DeliveryRows.tsx apps/personal-calibre-e2e/src/deliveries.spec.ts
git commit -m "refactor(personal-calibre): build delivery rows from Item, Field and Spinner

Platform rows and History entries are lib Items in role=list groups, the
add form uses Field with the same ids and aria wiring, and Save and the
History remove button show a Spinner while their request runs.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 12: Calibre sort and bulk controls with ButtonGroup and Spinner

**Files:**

- Modify: `apps/personal-calibre/src/components/library/SortControls.tsx:65-101`
- Modify: `apps/personal-calibre/src/components/library/BulkToolbar.tsx` (whole file)
- Test: `apps/personal-calibre-e2e/src/filters.spec.ts`, `apps/personal-calibre-e2e/src/bulk.spec.ts`

**Interfaces:**

- Consumes: `ButtonGroup` (Task 7), `Spinner` (Task 4).
- Produces: `SortControls()`, `BulkToolbar({ platforms, matchingIds })`, unchanged signatures.

- [ ] **Step 1: Write the failing e2e tests**

In `filters.spec.ts`, test `sort, direction and group change the URL and drop page`, right after `await gotoLibrary(page, '/?page=2');` add:

```ts
await expect(
  page
    .getByRole('button', { name: 'Sort direction: ascending' })
    .locator('xpath=..'),
).toHaveAttribute('data-slot', 'button-group');
```

In `bulk.spec.ts`, inside `test.describe('bulk', …)`, add:

```ts
test('Mark delivered sits in a group with its platform and shows a spinner while it runs', async ({
  page,
}) => {
  await gotoLibrary(page, '/?series=2');
  await selectOption(page, 2);
  const add = toolbar(page).getByRole('combobox', { name: 'Add to' });
  await expect(add.locator('xpath=..')).toHaveAttribute(
    'data-slot',
    'button-group',
  );
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/books/deliveries/bulk', async (route) => {
    await held;
    await route.continue();
  });
  await add.click();
  await page.getByRole('option', { name: 'Readwise Reader' }).click();
  const mark = toolbar(page).getByRole('button', { name: 'Mark delivered' });
  await mark.click();
  await expect(mark).toBeDisabled();
  await expect(mark.locator('[data-slot="spinner"]')).toBeVisible();
  await expect(
    toolbar(page).getByRole('button', { name: /ZIP/ }),
  ).toBeDisabled();
  release();
  await expect(toolbar(page)).toHaveCount(0);
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 900; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- src/filters.spec.ts src/bulk.spec.ts
```

Expected: both new checks FAIL on `data-slot="button-group"`.

- [ ] **Step 3: Rewrite SortControls and BulkToolbar**

In `SortControls.tsx`, add `ButtonGroup,` to the `@rainforest-dev/rainforest-react` import (after `Button,`) and replace the `SortControls` function with:

```tsx
export function SortControls() {
  const params = parseLibraryParams(useSearchParams());
  const { replaceParams } = useLibrary();
  const descending = params.sortDir === 'desc';
  return (
    <ButtonGroup>
      <Select
        items={SORT_ITEMS}
        value={params.sortBy}
        onValueChange={(value) => {
          const next = SORT_BYS.find((s) => s === value);
          if (next) replaceParams({ sortBy: next });
        }}
      >
        <SelectTrigger size="sm" aria-label="Sort">
          <span className="text-muted-foreground text-xs">Sort</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={`Sort direction: ${descending ? 'descending' : 'ascending'}`}
        onClick={() => replaceParams({ sortDir: descending ? 'asc' : 'desc' })}
      >
        {descending ? <ArrowDown aria-hidden /> : <ArrowUp aria-hidden />}
      </Button>
    </ButtonGroup>
  );
}
```

`apps/personal-calibre/src/components/library/BulkToolbar.tsx`:

```tsx
'use client';

import {
  Button,
  ButtonGroup,
  Kbd,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  toast,
} from '@rainforest-dev/rainforest-react';
import { Download, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { platformName } from '@/lib/platforms';
import type { DeliveryPlatform } from '@/types/delivery';

import { useLibrary } from './LibraryProvider';

const ZIP_FORMATS = ['EPUB', 'PDF', 'MOBI', 'AZW3'];

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export function BulkToolbar({
  platforms,
  matchingIds,
}: {
  platforms: DeliveryPlatform[];
  matchingIds: number[];
}) {
  const router = useRouter();
  const {
    selected,
    clear,
    addMany,
    bulkPlatform,
    setBulkPlatform,
    zipFormat,
    setZipFormat,
    setSelectMode,
    focusAfterToolbar,
  } = useLibrary();
  const [pending, setPending] = useState<'deliver' | 'zip' | null>(null);
  const busy = pending !== null;
  const toolbarRef = useRef<HTMLDivElement>(null);
  const platformKey = bulkPlatform || platforms[0]?.key || '';
  const count = selected.size;
  const everyMatchSelected =
    matchingIds.length > 0 && matchingIds.every((id) => selected.has(id));

  async function markDelivered() {
    if (!platformKey) return;
    setPending('deliver');
    try {
      const res = await fetch('/api/books/deliveries/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookIds: [...selected], platformKey }),
      });
      if (!res.ok)
        throw new Error(await readError(res, 'Failed to add deliveries'));
      toast.success(
        `${count} book${count === 1 ? '' : 's'} marked as delivered to ${platformName(platforms, platformKey)}`,
      );
      clear();
      setSelectMode(false);
      const active = document.activeElement;
      if (
        active === null ||
        active === document.body ||
        toolbarRef.current?.contains(active)
      ) {
        focusAfterToolbar();
      }
      router.refresh();
    } catch (error) {
      toast.error(`Delivery failed — ${messageOf(error)}`);
    } finally {
      setPending(null);
    }
  }

  async function downloadZip() {
    setPending('zip');
    try {
      const res = await fetch('/api/books/download/bulk', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookIds: [...selected], format: zipFormat }),
      });
      if (!res.ok) throw new Error(await readError(res, 'Failed to build ZIP'));
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'books.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(`Download failed — ${messageOf(error)}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Bulk actions"
      className="bg-card fixed inset-x-2 bottom-2 z-40 flex flex-wrap items-center gap-2 rounded-xl border p-2 shadow-lg lg:static lg:z-auto lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Clear selection (Esc)"
        disabled={busy}
        onClick={() => {
          clear();
          focusAfterToolbar();
        }}
      >
        <X aria-hidden />
      </Button>
      <span className="text-sm font-medium tabular-nums">{count} selected</span>
      {!everyMatchSelected && (
        <Button
          variant="link"
          size="xs"
          disabled={busy}
          onClick={() => addMany(matchingIds)}
        >
          Select all {matchingIds.length}
        </Button>
      )}
      <ButtonGroup className="lg:ml-auto">
        <Select
          items={platforms.map((p) => ({ value: p.key, label: p.name }))}
          value={platformKey}
          onValueChange={(value) => {
            if (typeof value === 'string') setBulkPlatform(value);
          }}
        >
          <SelectTrigger size="sm" aria-label="Add to">
            <span className="text-muted-foreground text-xs">Add to</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={busy || !platformKey}
          onClick={() => void markDelivered()}
        >
          {pending === 'deliver' && <Spinner data-icon="inline-start" />}
          Mark delivered
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Select
          items={ZIP_FORMATS.map((f) => ({ value: f, label: f }))}
          value={zipFormat}
          onValueChange={(value) => {
            if (typeof value === 'string') setZipFormat(value);
          }}
        >
          <SelectTrigger size="sm" aria-label="Download format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ZIP_FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void downloadZip()}
        >
          {pending === 'zip' ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Download aria-hidden />
          )}
          ZIP
        </Button>
      </ButtonGroup>
      <span className="text-muted-foreground hidden items-center gap-1 text-xs lg:inline-flex">
        <Kbd>Esc</Kbd> clear
      </span>
    </div>
  );
}
```

Before saving, diff the rewritten BulkToolbar against the Task 3 version (`git diff HEAD -- apps/personal-calibre/src/components/library/BulkToolbar.tsx`): the only changes must be the `ButtonGroup` and `Spinner` imports, `busy` becoming `pending`, the two `ButtonGroup` wrappers and the two spinner expressions. Restore anything else from HEAD.

- [ ] **Step 4: Run the specs to verify they pass**

```bash
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 1500; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- src/filters.spec.ts src/bulk.spec.ts src/keyboard.spec.ts src/catalogue.spec.ts src/a11y.spec.ts
perl -e 'alarm 900; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache -- --project=phone
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
```

Expected: PASS, including `Tab from the toolbar lands on a tile` and the bulk toolbar axe check.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck -p personal-calibre personal-calibre-e2e
git checkout -- apps/personal-calibre/next-env.d.ts
git add apps/personal-calibre/src/components/library/SortControls.tsx apps/personal-calibre/src/components/library/BulkToolbar.tsx apps/personal-calibre-e2e/src/filters.spec.ts apps/personal-calibre-e2e/src/bulk.spec.ts
git commit -m "refactor(personal-calibre): join selects and their actions with ButtonGroup

Sort and its direction, Add to and Mark delivered, and the ZIP format and
its download are ButtonGroups. The bulk toolbar tracks which request is
running, so the spinner lands on that button while every control stays
disabled.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 13: rss-manager spinners and empty states

rss-manager has no component tests, so this task verifies with lint, typecheck, its Vitest suite, the build and a dev-server check against the Task 1 fixture vault.

**Files:**

- Modify: `apps/rss-manager/src/components/FeedValidator.tsx:1-7`, `:56-58`
- Modify: `apps/rss-manager/src/components/SourceTable.tsx:1-15`, `:293-300`, `:320-329`, `:337-341`
- Modify: `apps/rss-manager/src/components/TopicList.tsx:1-7`, `:152-169`
- Modify: `apps/rss-manager/src/components/ReadingQueue.tsx:1`, `:127-139`

**Interfaces:**

- Consumes: `Spinner` (Task 4); `Empty`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription` (Task 5).

- [ ] **Step 1: Edit FeedValidator**

Add `Spinner,` to the `@rainforest-dev/rainforest-react` import (after `Input,`). Replace

```tsx
<Button onClick={validate} disabled={!url || loading}>
  {loading ? 'Checking…' : 'Validate'}
</Button>
```

with

```tsx
<Button onClick={validate} disabled={!url || loading}>
  {loading && <Spinner data-icon="inline-start" />}
  {loading ? 'Checking…' : 'Validate'}
</Button>
```

- [ ] **Step 2: Edit SourceTable**

Add `Empty,`, `EmptyHeader,`, `EmptyTitle,` (after `buttonVariants,`) and `Spinner,` (after `Input,`) to the import. Replace

```tsx
{
  pending.has(s.name) ? '…' : 'Activate';
}
```

with

```tsx
{
  pending.has(s.name) && <Spinner data-icon="inline-start" />;
}
Activate;
```

Replace

```tsx
{
  pending.has(s.name) ? '…' : 'Retire';
}
```

with

```tsx
{
  pending.has(s.name) && <Spinner data-icon="inline-start" />;
}
Retire;
```

Replace

```tsx
{
  filtered.length === 0 && (
    <p className="text-muted-foreground py-8 text-center">
      No sources match the current filter.
    </p>
  );
}
```

with

```tsx
{
  filtered.length === 0 && (
    <Empty className="py-8">
      <EmptyHeader>
        <EmptyTitle>No sources match the current filter.</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}
```

- [ ] **Step 3: Edit TopicList**

Add `Spinner,` to the import (after `Button,`). Replace

```tsx
{
  pending.has(t.name) ? '…' : 'Activate';
}
```

with

```tsx
{
  pending.has(t.name) && <Spinner data-icon="inline-start" />;
}
Activate;
```

and

```tsx
{
  pending.has(t.name) ? '…' : 'Decline';
}
```

with

```tsx
{
  pending.has(t.name) && <Spinner data-icon="inline-start" />;
}
Decline;
```

- [ ] **Step 4: Edit ReadingQueue**

Change line 1 to

```tsx
import {
  Badge,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@rainforest-dev/rainforest-react';
```

Replace

```tsx
<div className="py-12 text-center">
  <p className="text-muted-foreground">
    No reading queue has been generated yet.
  </p>
  <p className="text-muted-foreground mt-2 text-sm">
    Run the <code className="text-primary">reading-queue</code> skill to build
    one.
  </p>
</div>
```

with

```tsx
<Empty className="py-12">
  <EmptyHeader>
    <EmptyTitle>No reading queue has been generated yet.</EmptyTitle>
    <EmptyDescription>
      Run the <code className="text-primary">reading-queue</code> skill to build
      one.
    </EmptyDescription>
  </EmptyHeader>
</Empty>
```

- [ ] **Step 5: Lint, typecheck, test, build**

```bash
perl -e 'alarm 900; exec @ARGV' -- pnpm nx lint rss-manager --fix
perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck test build -p rss-manager --skip-nx-cache
```

Expected: PASS (the build runs `astro check`).

- [ ] **Step 6: Dev-server check**

```bash
VAULT_PATH="$CAPTURE_DIR/rss-vault" pnpm nx dev rss-manager --skip-nx-cache
```

In the background. Load `http://localhost:3002/?tab=sources`, type `zzz` in the filter field and confirm "No sources match the current filter." renders inside `[data-slot="empty"]`. Click Activate on "Example Build Log" and confirm a `[data-slot="spinner"]` shows in the button until it settles (the fixture files are writable). Load `?tab=queue` and confirm the Empty "No reading queue has been generated yet." Confirm no console errors. Stop the server and restore the fixture vault files from Task 1 step 4 if Activate rewrote them.

- [ ] **Step 7: Commit**

```bash
git add apps/rss-manager/src/components/FeedValidator.tsx apps/rss-manager/src/components/SourceTable.tsx apps/rss-manager/src/components/TopicList.tsx apps/rss-manager/src/components/ReadingQueue.tsx
git commit -m "refactor(rss-manager): show pending actions with Spinner and empty lists with Empty

Activate, Retire, Decline and Validate keep their label and add a
Spinner while the request runs, instead of turning into an ellipsis.
The no-match table and the missing reading queue use the lib Empty.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 14: memories empty timeline uses Empty

**Files:**

- Modify: `apps/personal-memories/src/components/EmptyState.astro` (whole file)

**Interfaces:**

- Consumes: `Empty`, `EmptyContent`, `EmptyDescription`, `EmptyHeader`, `EmptyTitle` (Task 5). Props unchanged: `{ path: string | undefined }`.

- [ ] **Step 1: Rewrite EmptyState**

`apps/personal-memories/src/components/EmptyState.astro`:

```astro
---
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@rainforest-dev/rainforest-react';

type Props = { path: string | undefined };

const { path } = Astro.props;
---

<Empty className="border">
  <EmptyHeader>
    <EmptyTitle>還沒有時間軸</EmptyTitle>
    <EmptyDescription>
      {
        path ? (
          <>
            找不到 <code>{path}</code>。
          </>
        ) : (
          <>
            尚未設定 <code>MEMORIES_DATA_DIR</code>。
          </>
        )
      }
      先執行匯入：
    </EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <pre
      class="bg-muted w-full overflow-x-auto rounded-md p-3 text-left text-xs"><code>MEMORIES_DATA_DIR=… pnpm nx run personal-memories:ingest</code></pre>
  </EmptyContent>
</Empty>
```

- [ ] **Step 2: Lint, typecheck, test**

Run: `perl -e 'alarm 900; exec @ARGV' -- pnpm nx run-many -t lint typecheck test -p personal-memories --skip-nx-cache`
Expected: PASS.

- [ ] **Step 3: Dev-server check with a missing data directory**

```bash
MEMORIES_DATA_DIR="$CAPTURE_DIR/no-such-dir" MEMORIES_NOTES_DIR="$CAPTURE_DIR/memories-notes" \
  pnpm --dir apps/personal-memories exec astro dev --host 127.0.0.1 --port 3024 --ignore-lock
```

In the background. Load `http://127.0.0.1:3024/`, confirm "還沒有時間軸" renders inside `[data-slot="empty"]` with the path and the ingest command, and no console errors. Stop the server.

- [ ] **Step 4: Run the memories e2e suite**

Run: `perl -e 'alarm 1800; exec @ARGV' -- pnpm nx e2e personal-memories-e2e --skip-nx-cache`
Expected: PASS (or the same failures as the Task 1 baseline).

- [ ] **Step 5: Commit**

```bash
git add apps/personal-memories/src/components/EmptyState.astro
git commit -m "refactor(personal-memories): show the missing timeline with Empty

The no-data notice is an empty state, so it uses the lib Empty instead
of an Alert. Copy and the ingest command are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019jxqNqgwsWWikAfS8FuLgm"
```

---

### Task 15: Full verification and "after" captures

No commit unless a check forces a fix; a fix goes in its own commit with the scope of the file it touches.

**Files:**

- Create (outside the repo): `$CAPTURE_DIR/after/*`

**Interfaces:**

- Consumes: `capture.cjs` and the fixtures from Task 1.

- [ ] **Step 1: Run every suite**

```bash
perl -e 'alarm 1800; exec @ARGV' -- pnpm nx run-many -t lint typecheck test -p rainforest-ui rainforest-react personal-calibre personal-calibre-e2e rss-manager personal-memories --skip-nx-cache
perl -e 'alarm 900; exec @ARGV' -- pnpm nx build-storybook rainforest-react --skip-nx-cache
perl -e 'alarm 1200; exec @ARGV' -- pnpm nx build personal-calibre --skip-nx-cache
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
perl -e 'alarm 2400; exec @ARGV' -- pnpm nx e2e personal-calibre-e2e --skip-nx-cache
pids=$(lsof -tiTCP:3333 -sTCP:LISTEN); [ -n "$pids" ] && kill $pids
pnpm format:check
git checkout -- apps/personal-calibre/next-env.d.ts
```

Expected: all green, apart from failures already listed in `$CAPTURE_DIR/baseline.txt`.

- [ ] **Step 2: Scan the branch for comments**

Run: `git diff -U0 main...HEAD | grep -E '^\+\s*(//|/\*|\*|#|\{/\*)'`
Expected hits, each allowed: the component docstrings in `spinner.tsx`, `empty.tsx`, `label.tsx`, `field.tsx`, `button-group.tsx`, `item.tsx`; the recipe docstrings in the four new recipe files; the `jsx-a11y` suppression reason in `label.tsx` (if kept); the clipping note in `shadcn.test.ts`; Markdown headings in the two docs and `conventions.md`. Remove anything else.

- [ ] **Step 3: Confirm the owner's checks**

Run: `git grep -n "dark:" -- libs/rainforest-react/src/components libs/rainforest-ui/src/recipes; ls libs/rainforest-react/components.json`
Expected: no `dark:` hits, and `ls` reports that `components.json` does not exist.

- [ ] **Step 4: Capture "after"**

Start the four servers exactly as in Task 1 steps 5 and 6, one at a time, and run the same `node capture.cjs` commands with `after` in place of `before`. Then add the after-only calibre states:

```bash
node capture.cjs after calibre-empty-slot 'http://localhost:3335/?q=zzzz-no-such-book' '[data-slot="empty"]'
node capture.cjs after calibre-item-group 'http://localhost:3335/?book=38' '[data-slot="item-group"]'
node capture.cjs after calibre-sort-group 'http://localhost:3335/' '[data-slot="button-group"]'
```

Expected: every `after/*.json` with a primary-filled target reports `ratio` of 4.5 or more, and each `calibre-read` now matches by selector on a primary-filled link. Write a short `$CAPTURE_DIR/README.txt` listing each pair (before, after), its URL, the commit from its JSON and that all data is fixture data. Leave uploading to the PR step; do not commit captures.

- [ ] **Step 5: Stop every server and check the tree**

```bash
for port in 3002 3024 3333 3335 4321; do pids=$(lsof -tiTCP:$port -sTCP:LISTEN); [ -n "$pids" ] && kill $pids; done
git checkout -- apps/personal-calibre/next-env.d.ts
git status --short
```

Expected: `git status` prints nothing.
