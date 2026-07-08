# Personal MCP Split-Deployment — Design

**Date:** 2026-07-07
**Status:** approved
**Scope:** extract the profile content/data-access layer into a shared Nx library, move the MCP server out of `apps/personal-website` into its own Nx app and Vercel project, and bind `mcp.rainforest.tools` directly to that project.

**Supersedes:** §3 (Architecture) of `2026-07-04-personal-context-mcp-design.md`. That design's data model (§5) and tools/resources interface (§6) are unchanged in shape — only where the code lives and how the domain is routed changes.

---

## 1. Why

The original design colocated the MCP server inside `apps/personal-website` and routed `mcp.rainforest.tools` to it via a `vercel.json` rewrite with a `has: [{ type: "host", ... }]` condition. Two things prompted a rethink:

1. **The rewrite doesn't reliably fire.** Vercel's own docs only ever demonstrate `has: host` matching at the low-level Build Output API (`.vercel/output/config.json`), never through the higher-level `vercel.json` "rewrites" abstraction we used — and in practice, `mcp.rainforest.tools` fell through to the site's normal i18n redirect instead of reaching `/api/mcp`. Vercel's documented pattern for domain-differentiated routing within one project is **Middleware inspecting the hostname**, not a config-level rewrite.
2. **This is a personal ability-demonstration project.** A clean split — one Vercel project per concern, no cross-domain routing tricks — is a better showcase than working around a rewrite quirk, and this account already runs multiple independent Vercel projects from this monorepo on the Hobby plan (`personal-website`, `personal-liff`, `rss-manager`, `personal-calibre`), so a fifth project is no additional operational cost.

This also creates an opportunity to fix an unrelated wart: `apps/personal-website`'s `profile-data.ts` currently depends on `astro:content`, which cannot be resolved inside Vitest (a confirmed Astro/Vitest ecosystem gap — see `2026-07-04-personal-context-mcp-design.md` §9). Since **nothing on the live site actually renders the `organizations`/`experiences`/`projects`/`skills` collections today** (`profile-data.ts` is their only consumer), moving them out of Astro's content-collection system entirely removes that gap — the new library reads files directly and needs no framework-specific mocking to test.

---

## 2. Scope

**In scope:**
- New Nx library `libs/personal-data` — content files, Zod schemas, canonical vocabularies (skill tags, experience types, supported languages), and the plain data-access functions currently in `profile-data.ts`.
- New Nx app `apps/personal-mcp` — a minimal Hono service wrapping `mcp-handler`, importing `libs/personal-data`, deployed as its own Vercel project.
- `mcp.rainforest.tools` moved from the `personal-website` Vercel project to the new `personal-mcp` project (direct domain-to-project binding, no rewrite).
- Removal from `apps/personal-website`: `/api/mcp` route, `vercel.json`, the `organizations`/`experiences`/`projects`/`skills` entries in `content.config.ts`, the `mcp-handler`/`@modelcontextprotocol/sdk` dependencies, and the now-redundant `tags.skills`/`tags.experience`/`supportedLngs` definitions (re-pointed to import from `libs/personal-data` instead).

**Explicitly out of scope:**
- Everything in `2026-07-04-personal-context-mcp-design.md` §2's "out of scope" list still applies (blog search, WebMCP, private/authenticated tools, MCP registry submission).
- `@hono/zod-openapi` — considered, but the service exposes exactly one HTTP route (the MCP transport endpoint), whose request shapes are already validated and exposed via each tool's own Zod schema (surfaced through `tools/list`). Adding a parallel OpenAPI/REST layer has nothing to document yet. Revisit if a plain REST surface or the private/authenticated tools (future scope, above) are added later — at that point `apps/personal-mcp` gains more than one route and the auto-docs value becomes real.
- Rewriting the MCP server in Python (FastMCP) or Go — considered as a learning opportunity, but ruled out for *this* service because neither language can import a TypeScript Nx library; that would force the shared data into a language-neutral export step (static JSON) instead of a code-level import, which is a strictly worse fit given the site and the MCP server want to share the exact same resolve/filter logic, not just the raw data.

---

## 3. Architecture

```
libs/personal-data/          (new — Nx TS library, @rainforest-dev/personal-data)
  src/
    data/
      organizations/{en,zh}/*.json
      experiences/{en,zh}/*.md
      projects/{en,zh}/*.md
      skills/{en,zh}/*.md
    vocab.ts                 (skill tags, experience types, supported languages)
    schemas.ts               (Zod schemas per collection, using vocab.ts)
    loader.ts                (plain fs-based collection/entry loading — fast-glob + gray-matter + Zod parse, no astro:content)
    profile-data.ts          (resolve*/get* functions — ported from apps/personal-website/src/mcp/profile-data.ts, same signatures)
    index.ts                 (public exports)

apps/personal-mcp/           (new — Nx app, Hono + mcp-handler)
  src/
    server.ts                (Hono app: registers the mcp-handler route, error/logging middleware)
    tools.ts                 (server.registerTool/registerResource calls — ported from apps/personal-website/src/pages/api/mcp.ts)
  vercel.json                (build config only — no domain-conditional rewrite needed)
  → own Vercel project, mcp.rainforest.tools bound directly

apps/personal-website/       (existing — loses MCP-specific code)
  - content.config.ts: organizations/experiences/projects/skills collections removed
  - src/pages/api/mcp.ts: deleted
  - src/mcp/: deleted (profile-data.ts, profile-data.fixtures.ts, smoke.test.ts move to libs/personal-data in adapted form)
  - vercel.json: deleted
  - package.json: mcp-handler, @modelcontextprotocol/sdk removed; @rainforest-dev/personal-data added (workspace:*)
  - src/utils/constants, src/utils/i18n/settings: tags.skills/tags.experience/supportedLngs re-exported from @rainforest-dev/personal-data instead of defined locally
```

`libs/personal-data` follows the existing `libs/rainforest-ui` convention (Vite-built, `@rainforest-dev/*` package scope, `workspace:*` internal dependency) rather than introducing a new library pattern.

---

## 4. Data model changes

Same four entities as `2026-07-04-personal-context-mcp-design.md` §5 (`Organization`, `Experience`, `Project`, `Skill`), same fields, same bilingual-entries-not-nested-translations convention. What changes is *how* they're loaded:

- **Before:** `defineCollection({ loader: glob(...), schema: ... })` in Astro's `content.config.ts`, resolved at request time via `astro:content`'s `getCollection`/`getEntry`.
- **After:** `libs/personal-data/src/loader.ts` walks the same directory layout directly (`fast-glob` for file discovery, `gray-matter` for frontmatter+body parsing on the `.md` collections, `JSON.parse` for the `organizations` collection, which has no body), validates each entry against the Zod schemas in `schemas.ts`, and returns the same `{ id, data, body }`-shaped objects `profile-data.ts` already expects — so `profile-data.ts` itself needs only its imports changed (`astro:content` → `./loader`), not its logic.

Reference fields (`organization`, `projects`, `experience`) currently rely on Astro's `reference()` helper, which just validates that a string matches `{collection}/{id}` shape at build time — `loader.ts` reimplements this as a plain string field plus a lookup-by-id function, since there's no Astro-specific validation to lean on outside Astro.

---

## 5. `apps/personal-mcp` internals

- **`server.ts`**: a Hono app (plain, no `zod-openapi` per §2). Single responsibility: mount the `mcp-handler`-produced Fetch handler at the transport endpoint, plus whatever minimal middleware is worth having (request logging, a `/healthz` route for platform monitoring — not part of the MCP protocol surface itself).
- **`tools.ts`**: the six `server.registerTool` calls and three `server.registerResource` calls, ported verbatim from the current `apps/personal-website/src/pages/api/mcp.ts` (§6 of the original design — tool/resource list unchanged), now importing from `@rainforest-dev/personal-data` instead of the app-local `../../mcp/profile-data`.
- **Transport**: unchanged — stateless POST-only Streamable HTTP, same rationale as the original design's §4.
- **Root routing**: since this project serves *only* `mcp.rainforest.tools`, the MCP endpoint can live at the project root (`/`) rather than `/api/mcp` — no rewrite needed to make the friendly URL work, because there's no *other* content on this domain competing for the root path.

---

## 6. Testing

- **`libs/personal-data`**: unit tests against the real data files on disk (no mocking) — `loader.ts` is plain Node file I/O, so Vitest resolves it the same way it resolves any other module. This directly fixes the `astro:content`-mocking workaround documented in the original design's §9.
- **`apps/personal-mcp`**: integration tests using Hono's `app.request()` (in-memory, no real server needed) — call `tools/list`, call each tool, read each resource type, same coverage as the original design's local-integration step (§9), but runnable in Vitest directly instead of requiring a live `pnpm dev` + `curl` session.
- **Post-deploy**: unchanged from the original design — connect a real MCP client to `mcp.rainforest.tools` once live.

---

## 7. Migration & rollout order

1. Create `libs/personal-data`: move the data files and port `schemas.ts`/`loader.ts`/`profile-data.ts`. `apps/personal-website` starts importing from it but keeps its site behavior identical (nothing on the site renders this content, so this step is a no-op for the live site — just moving where the code lives).
2. Build `apps/personal-mcp` (Hono + `mcp-handler` + `libs/personal-data`), verify locally (`pnpm dev` equivalent + `curl`).
3. Push, let Vercel's Nx-aware build create a **new** Vercel project for `apps/personal-mcp`; verify on its own `*.vercel.app` URL.
4. Move the `mcp.rainforest.tools` domain from the `personal-website` Vercel project to the new `personal-mcp` project (manual dashboard step — no domain-management tool is available to automate this).
5. Remove the now-dead code from `apps/personal-website`: `/api/mcp` route, `vercel.json`, the four content collections, the MCP-related dependencies.
6. Verify `mcp.rainforest.tools` end-to-end with a real MCP client (Task 7 from the original plan, still pending).

---

## 8. Risks / open questions

- **Domain move has a brief propagation gap.** Moving `mcp.rainforest.tools` between Vercel projects means a short window where the old project no longer serves it and the new one hasn't finished domain verification/cert issuance — acceptable for a personal project with no uptime SLA, but worth doing during a low-traffic window rather than assuming instant cutover (this session's earlier outage investigation showed Vercel's domain verification isn't always instantaneous).
- **`organizations`' JSON-only shape has no body content** — `loader.ts` must special-case it (no frontmatter/body split) rather than assume every collection is Markdown.
