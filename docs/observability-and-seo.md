# Observability, Analytics & SEO

How `personal-website` is instrumented for search discovery, real-user metrics,
conversion tracking, error monitoring, and performance regression tracking — what
each piece is, where it lives, what turns it on, and **how to review that it's
actually working** (see [Periodic review](#periodic-review)).

> **No cookie-consent banner.** Every tool here is either cookieless by design
> (Vercel Analytics, the GA4 Measurement Protocol paths) or self-degrades without a
> consent signal (Clarity drops to a cookieless mode for EEA/UK/CH visitors — see
> [Clarity](#3-microsoft-clarity--heatmaps--session-replay)). There is deliberately
> **no client-side `gtag`**, which is what would require a banner.

---

## What's instrumented

| Layer | Tool | Turned on by | Status |
|---|---|---|---|
| Search / SEO | Canonical + hreflang, JSON-LD, sitemap, robots, llms.txt | always on | ✅ live |
| Search consoles | Google Search Console + Bing Webmaster | dashboards (verified) | ✅ live |
| Real-user metrics | Vercel Web Analytics + Speed Insights | `astro.config.mjs` | ✅ live |
| Product analytics | Microsoft Clarity (heatmaps + replay) | `PUBLIC_CLARITY_PROJECT_ID` | ✅ live |
| **Conversion tracking** | **Cookieless GA4 events via `/api/event`** | `GA_MEASUREMENT_ID` + `GA_API_SECRET` | ✅ live |
| AI-crawler analytics | GA4 Measurement Protocol (`ai_resource_fetch`) | `GA_MEASUREMENT_ID` + `GA_API_SECRET` | ✅ live (server-side) |
| Error monitoring | Sentry (`@sentry/astro`, error-only) | `PUBLIC_SENTRY_DSN` | ✅ live |
| Performance CI | Lighthouse CI (weekly + on-demand) | `.github/workflows/lighthouse.yml` | ✅ live on `main` |

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

**Consent:** Clarity is the one cookie-setting tool here, but it **self-degrades**.
Since Microsoft's Oct-2025 enforcement, a visit from the EEA/UK/CH without a consent
signal runs in a cookieless mode: a unique id per page view, **heatmaps and
page-level metrics still work**, while **session recordings and funnels are
limited**. That is why the site ships no consent banner — full features apply
outside those regions, and EU visitors are handled compliantly by Clarity itself.

### 4. GA4 — AI-crawler tracking + cookieless conversions

Both GA4 paths are **server-side Measurement Protocol** through one shared sender,
[`src/utils/ga4.ts`](../apps/personal-website/src/utils/ga4.ts). There is
deliberately **no client-side `gtag`**: a fresh random `client_id` is minted per
event, so nothing is stored on the visitor and no consent banner is required. The
trade-off is that GA4's *user/session* counts are meaningless here — **event counts
are the signal**, which is all these questions need.

**a) AI-crawler discovery** —
[`src/utils/track-ai-resource.ts`](../apps/personal-website/src/utils/track-ai-resource.ts)
fires `ai_resource_fetch { resource, bot }` when an AI crawler (GPTBot, ClaudeBot,
PerplexityBot, Google-Extended, CCBot…) fetches a machine endpoint (llms.txt,
llms-full.txt, the MCP routes).

**b) Recruiter conversions** — the browser posts to
[`src/pages/api/event.ts`](../apps/personal-website/src/pages/api/event.ts) (an
allowlisted, sanitised, same-origin-guarded sink that keeps `GA_API_SECRET`
server-side), driven by
[`src/scripts/conversion-tracking.ts`](../apps/personal-website/src/scripts/conversion-tracking.ts)
— one delegated click listener plus page-view hooks, loaded site-wide from
[`src/layouts/index.astro`](../apps/personal-website/src/layouts/index.astro):

| Event | Params | Fires when |
|---|---|---|
| `outbound_click` | `target`: `github` \| `linkedin` \| `email` | a profile/mail link is clicked |
| `contact_submit` | — | the contact form's `mailto:` submit is clicked |
| `resume_view` | — | `/resume` is viewed |
| `case_study_view` | `slug` | a `/portfolio/<slug>` page is viewed |

To add an event: add it to the `ALLOWED` map in `api/event.ts`, then call `send()`
from the client script. Dashboard: GA4 → Reports / Realtime.

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
| `GA_MEASUREMENT_ID` | Production | no | GA4 MP endpoint | `ga4.ts` (→ `track-ai-resource.ts`, `api/event.ts`) |
| `GA_API_SECRET` | Production | **yes** | GA4 MP auth | `ga4.ts` (→ `track-ai-resource.ts`, `api/event.ts`) |

> Both GA vars are **Production-scoped**, so GA4 events no-op on preview deploys —
> expected. Preview deploys are also behind Vercel Deployment Protection (they
> return `401` to unauthenticated requests), so verify `/api/event` against
> production, not a preview URL.

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
| RSS feed | GET `/rss.xml` (+ `/zh/rss.xml`) | 200, valid feed XML | 404 (it regressed once — see below) |
| Conversion sink | `POST /api/event` `{"event":"resume_view"}` | **204**; a bogus event returns 400 | 404/500 = tracking silently dead |

### Manual glance (login required)

| Dashboard | Look for | Notes |
|---|---|---|
| Search Console | Sitemap status **Success**; Pages indexed climbing; **high-impression / low-CTR queries** | those queries are the cheapest exposure win — sharpen those titles/descriptions |
| Bing Webmaster | Sitemap **Processed**; URLs discovered > 0 | feeds ChatGPT's search index |
| **GA4 — conversions** | `outbound_click` (github/linkedin/email), `contact_submit`, `resume_view`, `case_study_view` | **the recruiter funnel.** Count events, not users (ids are random by design) |
| GA4 — AI exposure | `ai_resource_fetch` present, trend by `bot` | are AI agents discovering you |
| Sentry | New unresolved issues; error-rate spikes after a deploy | |
| Clarity | Heatmaps on key pages; rage/dead-clicks | replay is limited for EU visitors (cookieless mode) |
| Vercel Speed Insights | RES score, TTFB, LCP, INP, CLS trend | TTFB should now be low — most routes are prerendered |

### The growth loop (why these are reviewed together)

Exposure sources (**Search Console** queries + Vercel referrers) → engagement
(**Clarity** + `case_study_view`) → conversion (`outbound_click` / `contact_submit`
/ `resume_view`). Read them in that order: if impressions are rising but
conversions aren't, the problem is the page, not the reach — and vice versa.

### Watch items

1. **Conversion baseline** — after ~2 weeks, note typical weekly counts for each
   event so later changes have something to compare against.
2. **GSC query mining** — pick the top high-impression/low-CTR pages each review
   and improve their title/description.
3. **`/rss.xml`** — regressed to 404 once (the `[lang]` route only emitted prefixed
   URLs); the auto-check above guards it.

---

## Change provenance

All merged to `main` and live in production:

| PR | Change |
|---|---|
| [#246](https://github.com/rainforest-dev/rainforest-monorepo/pull/246) | Redesign + interactive portfolio (the base this is instrumented on) |
| [#247](https://github.com/rainforest-dev/rainforest-monorepo/pull/247) | SEO (canonical/hreflang/robots→llms.txt), JSON-LD, hero-image perf, Clarity, Sentry, Lighthouse CI |
| [#251](https://github.com/rainforest-dev/rainforest-monorepo/pull/251) | Astro 7 + TypeScript 6 + Nx 23.1; route caching (`cacheVercel`), prerendered robots/settings |
| [#252](https://github.com/rainforest-dev/rainforest-monorepo/pull/252) | fix: English RSS feed at the canonical `/rss.xml` |
| [#253](https://github.com/rainforest-dev/rainforest-monorepo/pull/253) | Cookieless recruiter-conversion tracking (`/api/event` + client tracker) |
