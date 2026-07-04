# Personal Context MCP Server — Design

**Date:** 2026-07-04
**Status:** approved
**Scope:** `apps/personal-website` — new public, read-only MCP server exposing professional profile data (`mcp.rainforest.tools`), plus a revived structured content model for experiences/organizations/projects/skills

---

## 1. Why Now

A prior attempt exists on unmerged remote branch `origin/claude/add-mcp-website-context-011CUneBYG9kZj8pmVLGAtUP` (2025-11-04): a working MCP server (blog + full personal profile) using the low-level `@modelcontextprotocol/sdk` `Server` class over **stdio transport**. Stdio only works for local Claude Desktop configs — it cannot back a public `mcp.rainforest.tools` domain. The branch was never merged and the code no longer exists in the working tree.

Since then:
- The MCP spec's 2026-07-28 release (RC since 2026-05-21) makes the protocol **stateless at the core** — the same direction this design already needed for serverless hosting.
- Vercel ships an official `mcp-handler` package with built-in stateless Streamable HTTP and OAuth support, removing the need to hand-roll transport/auth plumbing.
- `career-design-2026-06.md` named `mcp.rainforest.tools` as a differentiator; a 2026-07-04 fact-check (see Obsidian vault `projects/personal-website/career-data-pull-2026-07-04/report.md` §1, F1) confirmed it had **no implementation progress** — this design is the actual follow-through.

---

## 2. Scope

**In scope (this design):**
- New MCP endpoint in `apps/personal-website`, public domain `mcp.rainforest.tools`
- Structured content model for `Organization` / `Experience` / `Project` / `Skill` (revived schema, new storage mechanism)
- Public, unauthenticated, read-only tools/resources over the profile data
- i18n support matching the site's existing bilingual (en/zh) convention

**Explicitly out of scope (follow-up work, listed but not designed here):**
- Blog search tools/resources (the old branch bundled these; kept separate to keep this scope tight)
- Populating the data model with current content (rss-manager, homelab MCP infra, Hermes Agent, etc. — see Obsidian vault `projects/personal-website/personal-projects-inventory-2026-07-04.md`) — tracked as a separate content checklist
- WebMCP (`navigator.modelContext`) — Google I/O 2026, W3C Community Group Draft, Chrome-only origin trial as of 2026-07. Serves a different purpose (lets a *visitor's* in-browser agent call page tools under the visitor's session) than this server (letting *remote* agents query professional context). Revisit when the deferred GenUI assistant (Layer 2, `generative-ui-research-2026.md`) is picked up — WebMCP's imperative tool registration is conceptually closer to that work.
- Private/authenticated tools (personal context for the owner's own AI assistants, not public visitors) — noted as a known future direction; the architecture (via `mcp-handler`'s `withMcpAuth`) supports adding this later without redesign, but nothing auth-gated ships in this round.
- MCP registry submission
- Content positioning rewrite (career-design Layer 1) and GenUI assistant (Layer 2) — separate sub-projects

---

## 3. Architecture

- New route colocated in `apps/personal-website` (no separate service/infra), using Astro's hybrid rendering (`export const prerender = false` on the MCP route) so it deploys as a Vercel Function alongside the static site.
- Public domain: `mcp.rainforest.tools`, configured as a Vercel project domain with a rewrite to the API route — same deployment, no separate project.
- Server implementation: **rewritten using Vercel's official `mcp-handler` package**, not a port of the old branch's low-level SDK code. This is a from-scratch reimplementation of the server layer; only the data *schema* concept is carried over from the old branch.
- Astro compatibility with `mcp-handler` is unverified (its docs/examples are Next.js `app/api/.../route.ts`). **First implementation task: a small spike** confirming `createMcpHandler`'s returned handler (a standard Fetch `Request → Response` function) wires cleanly into an Astro endpoint (`export const POST: APIRoute = ({ request }) => handler(request)`). If it doesn't wire cleanly, fall back to the raw `@modelcontextprotocol/sdk` `StreamableHTTPServerTransport` in stateless mode.

---

## 4. Transport

Stateless, **POST-only** Streamable HTTP — no SSE/GET stream. This server has no server-initiated push scenarios (pure read-only query/response), and the MCP spec treats the SSE half of Streamable HTTP as optional. Skipping it avoids Vercel serverless long-lived-connection constraints entirely, and matches the protocol's own 2026-07-28 stateless-core direction.

---

## 5. Data Model

Revive the old branch's schema, but store it as an **Astro Content Collection** (`src/content/profile/{experiences,organizations,projects,skills}`, Zod-validated via `src/content.config.ts`) instead of the old branch's hand-rolled directory scanner (`personal-data-reader.ts`). Rationale: the site's blog already uses content collections, giving schema validation, type safety, and a data source that a future resume-page rework could also consume — one source of truth instead of two mechanisms.

Fields (unchanged from the old branch's `types.ts`):

```ts
interface Organization {
  id: string; name: string; language: string;
  department?: string; link?: string;
}

interface Experience {
  id: string; type: 'job' | 'education'; language: string;
  organization: string; // ref → Organization.id
  position: string; startAt: Date; endAt?: Date;
  technologies?: string[]; projects?: string[]; // ref → Project.id[]
  content: string; // markdown description
}

interface Project {
  id: string; name: string; language: string;
  technologies: string[];
  organization: string; experience: string; // refs
  content: string;
}

interface Skill {
  id: string; name: string; icon: string;
  tags?: string[]; content: string;
}
```

Each entry carries its own `language`; bilingual content is two entries (one per locale) sharing the same logical `id` prefix, matching the site's existing i18n convention (not a single entry with nested translations).

---

## 6. Tools / Resources Interface

**Tools:**
- `get_profile_summary(lang?)` — professional overview
- `get_work_experience(technology?, lang?)`
- `get_education(lang?)`
- `get_projects(technology?, lang?)`
- `get_skills(lang?)`
- `search_by_technology(query, lang?)` — fuzzy/substring match on `query` against all `technologies` tags across experiences and projects (unlike the exact-tag `technology?` filter on `get_work_experience`/`get_projects`), returning matching experiences and projects together

**Resources:**
- `profile://experience/{id}`
- `profile://project/{id}`
- `profile://skill/{id}`

---

## 7. Auth

Fully public, no authentication, no rate limiting — this mirrors the resume/portfolio pages' own exposure level (public professional info), and deliberately avoids repeating the homelab OAuth gateway's known gap (no allowlist) by not pretending to gate something that doesn't need gating. Standard Vercel platform-level abuse protection (Firewall) applies with no custom config.

Future private/authenticated tools (noted as out of scope, §2) would use `mcp-handler`'s `withMcpAuth` + a `.well-known/oauth-protected-resource` metadata route — the same package already in use, no separate auth stack to design later.

---

## 8. i18n

`lang` is an optional parameter on every tool, resolved in this order: explicit `lang` arg → `Accept-Language` header → default `en`. Returns the content-collection entry matching that `language`. This reuses the data model's existing per-entry `language` field — no dependency on WebMCP's (currently nonexistent) i18n story.

---

## 9. Testing

- Local: `pnpm dev` + `curl` against the endpoint with raw JSON-RPC payloads (list tools, call each tool, read each resource type) to verify handler wiring before involving a real client.
- Post-deploy: connect a real MCP client (Claude.ai or Claude Code remote MCP connection) to the deployed `mcp.rainforest.tools` — verifies actual client interop, not just hand-written request scripts.
