# Observability, Analytics & SEO

How `personal-website` is instrumented for search discovery, real-user metrics,
error monitoring, and performance regression tracking — what each piece is, where
it lives, what turns it on, and **how to review that it's actually working**
(see [Periodic review](#periodic-review)).

> **Activation caveat.** The SEO, JSON-LD, Clarity, and Sentry work landed on the
> `analytics-perf` branch, which is **stacked on the redesign branch** — none of it
> is in production until that merges to `main` and deploys. The Vercel env vars
> below sit idle until then. `PUBLIC_SENTRY_DSN` is also scoped to **Preview**, so a
> preview deployment activates Sentry immediately (useful for validating before the
> merge).

---

## What's instrumented

| Layer | Tool | Turned on by | Status |
|---|---|---|---|
| Search / SEO | Canonical + hreflang, JSON-LD, sitemap, robots, llms.txt | always on (SSR) | ships with the branch |
| Search consoles | Google Search Console + Bing Webmaster | dashboards (verified) | ✅ live |
| Real-user metrics | Vercel Web Analytics + Speed Insights | `astro.config.mjs` | ✅ live (already on prod) |
| Product analytics | Microsoft Clarity (heatmaps + replay) | `PUBLIC_CLARITY_PROJECT_ID` | env-gated, idle until deploy |
| AI-crawler analytics | GA4 Measurement Protocol (`ai_resource_fetch`) | `GA_MEASUREMENT_ID` + `GA_API_SECRET` | ✅ live (server-side) |
| Error monitoring | Sentry (`@sentry/astro`, error-only) | `PUBLIC_SENTRY_DSN` | env-gated, idle until deploy |
| Performance CI | Lighthouse CI (weekly + on-demand) | `.github/workflows/lighthouse.yml` | active once on `main` |

---

## Components

### 1. SEO — search & agent discovery

- **Canonical + hreflang** — [`src/layouts/head.astro`](../apps/personal-website/src/layouts/head.astro).
  Self-referencing canonical on every page; `hreflang` alternates (`en`, `zh-Hant`,
  `x-default`) emitted only for the localized routes (home, `/portfolio`, `/resume`).
- **JSON-LD structured data** —
  [`src/components/pages/HomePage.astro`](../apps/personal-website/src/components/pages/HomePage.astro)
  emits a `WebSite` + `Person` `@graph`;
  [`src/layouts/blog.astro`](../apps/personal-website/src/layouts/blog.astro) emits
  `BlogPosting` per post. Gives search + AI agents a consistent identity.
- **Sitemap** — `@astrojs/sitemap` (in `astro.config.mjs`) generates
  `/sitemap-index.xml` → `/sitemap-0.xml`.
- **robots.txt** — [`src/pages/robots.txt.ts`](../apps/personal-website/src/pages/robots.txt.ts):
  `Allow: /`, references the sitemap, and points crawlers at `/llms.txt` +
  `/llms-full.txt`.
- **llms.txt / llms-full.txt** — [`src/pages/llms.txt.ts`](../apps/personal-website/src/pages/llms.txt.ts),
  [`src/pages/llms-full.txt.ts`](../apps/personal-website/src/pages/llms-full.txt.ts):
  machine-readable site summary for LLM agents (GEO / agent-SEO).
- **Hero image perf** —
  [`one-column.astro`](../apps/personal-website/src/components/home/hero/one-column.astro) /
  [`three-columns.astro`](../apps/personal-website/src/components/home/hero/three-columns.astro):
  `<Picture quality={72}>` + descriptive `alt` (LCP + accessibility).

### 2. Real-user metrics — Vercel

Web Analytics (page/visitor counts) and Speed Insights (Core Web Vitals: TTFB,
FCP, LCP, INP, CLS) are enabled via the `@astrojs/vercel` adapter in
[`astro.config.mjs`](../apps/personal-website/astro.config.mjs). `<SpeedInsights/>`
is rendered in `<body>` (not `<head>` — a custom element there closes the head
early and strands stylesheets, which was the FOUC bug fixed earlier).
Dashboards: Vercel → personal-website → Analytics / Speed Insights.

### 3. Microsoft Clarity — heatmaps + session replay

Env-gated inline tag in [`src/layouts/head.astro`](../apps/personal-website/src/layouts/head.astro),
loaded only when `PUBLIC_CLARITY_PROJECT_ID` is set (so dev/preview stay clean).
Dashboard: <https://clarity.microsoft.com>.

### 4. GA4 Measurement Protocol — AI-crawler tracking

[`src/utils/track-ai-resource.ts`](../apps/personal-website/src/utils/track-ai-resource.ts)
fires a **server-side** `ai_resource_fetch` event (via `mp/collect`) when an AI
crawler (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot…) fetches a
machine endpoint. There is **no** client-side gtag / `page_view` — human traffic
is covered by Vercel + Clarity. Needs `GA_MEASUREMENT_ID` + `GA_API_SECRET`.
Dashboard: GA4 → Reports / Realtime, event `ai_resource_fetch`.

### 5. Sentry — error monitoring

[`sentry.client.config.js`](../apps/personal-website/sentry.client.config.js) +
[`sentry.server.config.js`](../apps/personal-website/sentry.server.config.js),
wired in [`astro.config.mjs`](../apps/personal-website/astro.config.mjs) only when
`PUBLIC_SENTRY_DSN` is present. **Error monitoring only** — no performance tracing,
no session replay (tree-shaken out via the integration's `bundleSizeOptimizations`,
keeping the client bundle lean). No source-map upload → no `SENTRY_AUTH_TOKEN`, and
`@sentry/cli`'s build script is declined in `pnpm-workspace.yaml`'s `allowBuilds`.
Dashboard: <https://rainforesttools.sentry.io> (project `javascript-astro`).

### 6. Lighthouse CI — performance regression tracking

[`.lighthouserc.cjs`](../.lighthouserc.cjs) + [`.github/workflows/lighthouse.yml`](../.github/workflows/lighthouse.yml).
Audits the **deployed** site (SSR-on-Vercel can't be served statically, and dev
scores are unrealistic): weekly (Mondays 06:00 UTC) against production, plus
on-demand via `workflow_dispatch` with a `base_url` input to point at a preview.
Budgets are **`warn`-level** (4 categories + FCP/LCP/TBT/CLS), published to
temporary public storage — reports, doesn't block. Scheduled runs only fire once
the workflow is on `main`.

---

## Environment variables

Set in Vercel → personal-website → Settings → Environment Variables (Project scope).

| Variable | Scope | Sensitive | Purpose | Consumed by |
|---|---|---|---|---|
| `PUBLIC_SENTRY_DSN` | Production + Preview | no (public DSN) | Sentry init | `sentry.{client,server}.config.js` |
| `PUBLIC_CLARITY_PROJECT_ID` | Production | no | Clarity tag | `head.astro` |
| `GA_MEASUREMENT_ID` | Production | no | GA4 MP endpoint | `track-ai-resource.ts` |
| `GA_API_SECRET` | Production | **yes** | GA4 MP auth | `track-ai-resource.ts` |

> The `PUBLIC_` prefix is **required** for Sentry/Clarity: Vite only inlines
> `PUBLIC_`-prefixed vars into the client bundle. A Sentry DSN and a Clarity
> project id are public by design (ingest endpoints, not secrets).

---

## External dashboards configured

| Service | What was set up | Where |
|---|---|---|
| Google Search Console | Domain property `sc-domain:rainforest.tools` (DNS-verified); sitemap `sitemap-index.xml` submitted | <https://search.google.com/search-console> |
| Bing Webmaster Tools | Site imported from GSC (verified, Administrator); sitemap submitted | <https://www.bing.com/webmasters> |
| Microsoft Clarity | Project created; id in `PUBLIC_CLARITY_PROJECT_ID` | <https://clarity.microsoft.com> |
| Sentry | Org `rainforesttools`, project `javascript-astro`; DSN in `PUBLIC_SENTRY_DSN` | <https://rainforesttools.sentry.io> |
| GA4 | Measurement id + MP API secret | <https://analytics.google.com> |
| Vercel | Web Analytics + Speed Insights enabled | Vercel dashboard |

---

## Periodic review

**Cadence: weekly.** A recurring Claude Code scheduled task runs this review and
reports back. It auto-checks the **headless-reachable** items and flags the
**login-only** dashboards for a quick manual glance, because those sit behind auth
an unattended job can't open. To change the cadence or stop it, ask Claude to
update/remove the "weekly observability review" cron.

### Auto-checked (no login)

| Check | How | Healthy | Red flag |
|---|---|---|---|
| Sitemap live | GET `/sitemap-index.xml` | 200, valid XML index → `sitemap-0.xml` | non-200 / not XML |
| robots.txt | GET `/robots.txt` | `Allow: /` + `Sitemap:` line | disallow rules, missing sitemap |
| Lighthouse CI | `gh run list --workflow=lighthouse.yml` | recent run, no budget warnings trending down | perf/LCP/CLS warnings appearing |
| Vercel deploy | Vercel MCP / dashboard | latest Production deploy = Ready | build failing, cold-start TTFB spikes |
| llms.txt | GET `/llms.txt` + `/llms-full.txt` | 200, current content | 404 / stale |

### Manual glance (login required)

| Dashboard | Look for | Notes |
|---|---|---|
| Search Console | Sitemap status **Success** (not "Couldn't fetch"); Pages indexed climbing; no manual actions | "Couldn't fetch" right after submit is normal; should flip within hours |
| Bing Webmaster | Sitemap **Processed**; URLs discovered > 0 | data populates ~48h after import |
| Sentry | New unresolved issues; error-rate spikes after a deploy | only active once deployed to prod/preview |
| Clarity | Sessions recording; rage-clicks / dead-clicks | only active once deployed |
| GA4 | `ai_resource_fetch` events present | server-side AI-crawler signal |
| Vercel Speed Insights | RES score, TTFB, LCP, INP, CLS trend | TTFB was the prior bottleneck — watch it post-routing-refactor |

### First-month watch items

1. GSC sitemap "Couldn't fetch" → **Success** (within hours of submission).
2. Bing sitemap **Processing** → **Processed**, URLs discovered > 0 (~48h).
3. After `analytics-perf` merges + deploys: confirm Clarity sessions appear and
   Sentry receives a test error (both were idle pre-deploy).
4. Once the Lighthouse workflow is on `main`: confirm the weekly run executes and
   note the baseline scores.

---

## Change provenance

Commits on `analytics-perf` (stacked on the redesign branch):

| Commit | Change |
|---|---|
| `3c6e3d1` | SEO — canonical + hreflang + robots→llms.txt |
| `0a010d3` | JSON-LD — WebSite/Person (home), BlogPosting (posts) |
| `e608ad1` | perf — hero image quality 100→72 + descriptive alt |
| `97b88a9` | Microsoft Clarity (env-gated) |
| `3a4610a` | Sentry error monitoring (env-gated, error-only) |
| `f0f97d7` | Lighthouse CI |
