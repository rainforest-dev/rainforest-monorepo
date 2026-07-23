# Portfolio Case Studies on rainforest.tools — Design Spec

- **Date:** 2026-07-21
- **Branch:** `claude/rainforest-website-redesign-afb942`
- **Status:** Design approved in brainstorming; pending written-spec review → implementation plan.

## 1. Goal & context

Promote the four projects (Hoogii Wallet, Hashgreen DEX, HashgreenSwap/Pyke, OpenCGT) from
short bullet lists under *experiences* into first-class, interactive **portfolio case studies**
on rainforest.tools. The rich content already exists as four 5-section case studies built in
Claude Design (project `0c5411d1-48e7-4514-aef9-9dab9d268b9b`, `CaseStudy.dc.html`, `project`
prop enum `hoogii|dex|swap|opencgt`). This spec covers bringing them **natively into the repo**
while keeping `apps/personal-website` lean under Nx scope.

The four projects already exist as identity data:
`libs/personal-data/src/data/projects/{en,zh}/{hoogii-wallet,hashgreen-dex,hashgreen-swap,opencgt}.md`.
Per-section content (feature / contribution / tech / interaction, ×5 per project) is captured in
`docs/portfolio-interactive-sections-spec.md` — that file is the **content source of truth**;
this file is the **architecture source of truth**.

### Decisions locked in brainstorming
1. **Native in-repo ownership** — Claude Design was the design tool; the repo becomes canonical.
2. **New `libs/portfolio` Nx lib** holds case-study components + islands + data + MCP surface.
3. **React islands** for interactivity — authentic to the projects' real React/Next stacks, and
   `@astrojs/react` 5.0.7 is already configured (alongside `@astrojs/vue`).
4. **Microfrontend architecture rejected** (§3).
5. **shadcn-native per-project theming** (§7).
6. **MCP extended via composed register-contributions** (§9, "Flavor A").

## 2. Architecture — build-time boundaries, no runtime composition

```
libs/personal-data   ── project IDENTITY (slug, org, experience, tech tags)   [EXISTS]
        │  join by slug
        ▼
libs/portfolio       ── NEW source lib: case-study content + React islands
        │              + per-project theme tokens + MCP register-contribution
        ▼
apps/personal-website ── thin shell: routes, i18n, layout, SEO, nav, MCP composition root
```

`nx affected` rebuilds/tests only the layer touched. The app never grows past routing, layout,
and composition. `libs/portfolio` is a **non-buildable source lib** — Astro/Vite compiles its
`.tsx`/`.astro`/`.ts` directly, so there is no dist build step (leaner than `rainforest-ui`,
which is buildable because it is a *published* web-component library).

## 3. Microfrontend — considered and rejected

Surveyed the Astro-specific MFE options; none change the recommendation for a single-author,
single-deploy site:

| Option | What it buys | Verdict |
|---|---|---|
| Astro islands (already used) | per-component hydration | ✅ already the model; the "good 80%" of MFE |
| **Server Islands (`server:defer`)** | independent *dynamic* fragment + own caching/TTL, encrypted props | ❌ demos are cosmetic/client-side with no per-user data — pure overhead here |
| Module Federation (Vite plugin) | runtime remote composition | ❌ fights Astro SSR/islands, fragile, industry receding from it |
| Multi-Zones / multi-app | independent deploys | ❌ fragments shared nav/i18n/theme; one author, one deploy |

**Why:** MFE solves *team autonomy + independent deploys*. This site has neither constraint; its
constraint is *code modularity + lean app + fast site*, which is a **build-time library-boundary**
problem already solved by Nx libs + Astro islands. **Server Islands are noted as a future escape
hatch** only if a case study ever needs genuinely dynamic, independently-cached server data
(cosmetic demos never will).

## 4. `libs/portfolio` structure

```
libs/portfolio/
  src/
    content/
      {hoogii-wallet,hashgreen-dex,hashgreen-swap,opencgt}.ts  # typed 5-section case-study data
      types.ts                                                  # CaseStudy, Section, Interaction contracts
    islands/                                                    # React .tsx, one per interaction KIND
      JwtDecoder.tsx  CasbinPlayground.tsx  AmmCurve.tsx  PhraseGrid.tsx  PipelineDag.tsx  ...
    sections/
      CaseStudySection.astro                                    # presentational wrapper (feature → contribution → tech → island)
    theme.css                                                   # per-project scoped shadcn token overrides (§7)
    mcp.ts                                                       # registerPortfolioMcp(server) + descriptor rows (§9)
    index.ts                                                     # barrel exports
```

Every island is **pure, cosmetic, client-side**: no `crypto.subtle`, no real keys, no network;
all data mocked; `prefers-reduced-motion` honored. Interaction *kinds* never repeat within a
project (already enforced by the content spec).

## 5. Data model & flow

- `personal-data` stays the source of **identity**: slug, organization, experience link, tech
  tags (already in `projects/{en,zh}/*.md`).
- `portfolio` holds the **rich presentation**, keyed by the **same slug**.
- The Astro route joins them: identity + tech chips from `personal-data`, sections + islands from
  `portfolio`. One slug namespace, no duplication.
- Canonical slugs = the `personal-data` filenames (`hoogii-wallet`, `hashgreen-dex`,
  `hashgreen-swap`, `opencgt`); mapped to Claude Design variants (`hoogii`, `dex`, `swap`,
  `opencgt`) only during porting.
- **A case study is optional per project.** The index lists every `personal-data` project; a
  project links to `/portfolio/[slug]` only when a matching `libs/portfolio` slug exists,
  otherwise it renders as a summary card. This lets the project list grow freely while only the
  worthiest get a deep-built case study.
- **Curation field (schema addition):** add optional **`featured?: boolean`** (and optional
  `order?: number`) to `projectSchema` in `libs/personal-data/src/schemas.ts` **and** the mirrored
  `content.config.ts` (they must stay in sync — see their comments). This is an identity-level
  signal consumed uniformly by the resume, home, and portfolio index (§16). Mirrors the existing
  `prioritized`-tag convention already used for skills.

## 6. Routing & IA

- `apps/personal-website/src/pages/[lang]/portfolio/index.astro` — **featured-first**: `featured`
  projects get prominent hero/large cards up top; the rest fall into a compact grid or behind a
  "view all" (progressive disclosure), so the first screen stays the 1–3 worthiest as the set
  grows. Optional by-tech/by-role filtering reuses the existing `$filter` nanostore.
- `apps/personal-website/src/pages/[lang]/portfolio/[slug].astro` — detail page: 5 sections,
  islands hydrated `client:visible` (mount only when scrolled into view).
- Swap the nav's `portfolio` link (currently the external cake.me URL in
  `src/utils/constants/index.ts`) → internal `/[lang]/portfolio`.
- Reuses existing `Layout`, `Nav`, i18n, and Tailwind theme tokens.

## 7. Theming — shadcn-native, per-project scoped

The site uses Tailwind v4 + the `@rainforest-dev/rainforest-ui/tailwindcss/shadcn` plugin
(CSS-variable tokens). Per-project theming is a **scoped override of the shadcn `primary`
cluster**, not a new theme system and not MD3 palette generation.

- One shared **token contract** (the shadcn `primary` cluster: `--primary`, `--primary-foreground`,
  `--ring`, optionally `--accent`/`--accent-foreground`) that all four projects fill.
- Values live in a **theme map keyed by project slug** in `libs/portfolio`, emitted to
  `theme.css` as `[data-project="<slug>"] { … }` blocks (plus a `.dark` counterpart each).
- The detail route root carries `<article data-project="<slug>">`; leaving the route restores the
  global theme — **zero JS, zero leakage** into nav/home.
- Base tokens (background/foreground/card/border/muted) stay global, so the shell stays
  "rainforest.tools" and light/dark keeps working. Only the accent slice varies.
- Islands use stock shadcn utilities (`bg-primary`, `text-primary-foreground`, `ring-primary`),
  so they re-skin from the scoped override and inherit light/dark for free.
- Accent seeds (hand-set hex, both schemes): Hoogii violet, Dex `#008C15`, Swap `#00F8CB`,
  OpenCGT `#1976D2`.
- Optional/additive: extend the existing `theme-color-modifier` pattern so the mobile browser
  chrome adopts the project accent on a case-study page.

## 8. Interactivity — React islands

- Authored as React `.tsx` in `libs/portfolio/src/islands`, hydrated via `@astrojs/react` with
  `client:visible`.
- React ships **only to `/portfolio/*`**; the rest of the site stays Vue-only (Astro splits
  per-route). Vue remains for existing site chrome.
- Island logic (pure compute — AMM math, Casbin match, JWT decode) is separated from presentation
  so it is unit-testable.

## 9. MCP surface — composed register-contributions (Flavor A)

Today `createProfileMcpHandler` hand-wires all tools/resources in one app-owned closure. Invert
to a **composition root**: each domain lib contributes its own registrations.

- Extract existing registrations into `registerProfileMcp(server)` (+ `PROFILE_MCP_TOOLS/RESOURCES`
  descriptor rows). **This stays in the app** (`src/mcp/`) for now, because it depends on
  `astro:content` (the skills resource uses `getEntry`); moving it into `libs/personal-data`
  would pull the Astro content runtime into a lib and is deliberately not done here.
- `libs/portfolio/src/mcp.ts` exports `registerPortfolioMcp(server)` + `PORTFOLIO_MCP_*` rows,
  sourcing case-study data from the lib's own typed content (no `astro:content` dependency).
- The app handler becomes: `createMcpHandler(server => { registerProfileMcp(server); registerPortfolioMcp(server); })`.
- Merged descriptor arrays (`[...PROFILE_MCP_TOOLS, ...PORTFOLIO_MCP_TOOLS]`) keep
  `llms.txt.ts` / `llms-full.txt.ts` in sync automatically.

**Minimal portfolio surface (YAGNI):**
- Resource `portfolio://case-study/{+slug}` → structured 5-section case study (mirrors the
  existing `profile://project/{+id}` style, same slug namespace).
- Optional tool `get_case_study(slug, lang?)` for tool-preferring agents.
- Joins by slug to existing project data — the MCP layer mirrors the UI join.

Rejected the global self-registering registry (Flavor B) as over-engineering for a two-feature app.

## 10. DesignSync porting workflow

DesignSync is the **read bridge** Claude Design → repo. For each project:
`DesignSync get_file` pulls that variant's built source from `0c5411d1…/CaseStudy.dc.html`
→ translate each of its 5 sections into a React island + Astro wrapper, preserving real symbols
and cosmetic-only behavior. (The separate rainforest-ui ↔ design-system sync is a follow-up
spec, out of scope here.)

## 11. i18n

**English-first** (Claude Design content is en-only). Routes are i18n-ready (`[lang]`), and
`personal-data` already has zh project bullets, so zh case-study translation is a clean
follow-up, not a blocker.

## 12. Testing & leanness guarantees

- Vitest unit tests for island *logic* (pure compute functions) in the lib.
- One render smoke test per detail page.
- Leanness: app = shell only; React ships only to `/portfolio/*`; islands `client:visible`; no
  MFE runtime, no federation tax; `libs/portfolio` non-buildable source lib.

## 13. Scope boundaries (YAGNI)

Out of scope: zh translations; rainforest-ui ↔ design-system sync; redesign of home/experience
sections; analytics on the demos; a global self-registering MCP registry; Server Islands.

## 14. Risks & mitigations

- **React bundle on portfolio routes** → `client:visible` + per-island code-split; keep islands
  small; measure with the existing Vercel analytics.
- **Island logic drifting from real repo symbols** → port names verbatim from the content spec;
  the demos stay cosmetic so there is no behavioral contract to maintain.
- **Theme leakage** → attribute-scoped tokens only; never set accents on `:root`.
- **MCP refactor regressions** → extract profile registrations unchanged first (pure move),
  verify the existing tool surface, then add portfolio.

## 15. Implementation phases (high-level; detailed plan follows via writing-plans)

1. Scaffold `libs/portfolio` (Nx source lib, boundaries, tsconfig refs).
2. Add `featured?`/`order?` to the project schema (lib + `content.config.ts`) — the curation signal.
3. Content model + typed data for the four case studies (port from content spec via DesignSync).
4. React islands (one per interaction kind) + section wrapper + shadcn theme tokens.
5. Astro routes (`/[lang]/portfolio` featured-first index + `[slug]`) + nav link swap.
6. Cross-linking pass (§17): home experience bullets, resume + full-URL/JSON-LD, MCP `caseStudyUrl`, llms.txt.
7. MCP composition-root refactor + `registerPortfolioMcp` + resource/tool.
8. Tests (island logic + render smoke) + leanness/perf check.

## 16. Scalability & curation

The design is **additive** — a new project is data, not code:

| To add a project | Touch | Untouched |
|---|---|---|
| Identity (always) | `personal-data/projects/{en,zh}/<slug>.md` | — |
| Full case study (optional) | `libs/portfolio/content/<slug>.ts` + one `[data-project="<slug>"]` theme row | index/detail routes, MCP, section components |

Routes and the MCP resource **iterate the collection**, so they pick up new projects with no edit.
**First-glance focus** is preserved by the `featured`/`order` curation signal (§5) driving the
featured-first index (§6): as the list grows, the top of the page stays the 1–3 worthiest, the
long tail is progressively disclosed, and projects without a case study degrade gracefully to
summary cards. The same `featured` signal curates the resume (§17), so the one-pager shows only
headline work and links out for depth rather than trying to contain everything.

## 17. Cross-linking map

Every surface that mentions a project links to its case study **only when a matching
`libs/portfolio` slug exists** (summary-only projects never dead-link):

| Mention site | File | Link |
|---|---|---|
| Nav "portfolio" | `utils/constants/index.ts` | → `/[lang]/portfolio` (replaces cake.me) |
| Home experience bullets | `components/home/experiences/project.astro` | name → `/[lang]/portfolio/[slug]` |
| Resume | `components/resume/ats-friendly.astro` | featured projects → case study (render full URL for print/ATS) |
| MCP project resource | `mcp/handler.ts` | add `caseStudyUrl` to the resolved project shape |
| llms.txt / llms-full.txt | `pages/llms*.ts` | list case-study URLs for agent crawling |
| schema.org JSON-LD | `[lang]/resume.astro` | `hasPart`/`subjectOf` → case-study URLs |

Principle: **resume = curated teaser → portfolio = depth.** The resume carries `featured` highlights
+ links; the portfolio holds the full set and the rich detail.
