# Personal MCP Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy `apps/personal-mcp` as its own Vercel project, move the `mcp.rainforest.tools` domain onto it, remove the now-dead MCP code from `apps/personal-website`, and verify the whole thing end-to-end with a real MCP client.

**Architecture:** No new code — this plan is deployment and decommissioning. It assumes `2026-07-07-personal-data-library.md` and `2026-07-07-personal-mcp-app.md` are both complete and merged to `main`.

**Tech Stack:** Vercel dashboard (project creation, domain management — no domain-management tool is available via API/MCP for this account, confirmed during the original Task 6 investigation), `gh` CLI for the PR.

---

## Part 1: Design reference

See `docs/superpowers/specs/2026-07-07-personal-mcp-split-design.md` §7 (steps 3–6) and §8 (risks — the domain-move propagation gap).

**Prerequisite check before starting:**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git log --oneline -1 -- apps/personal-mcp
git log --oneline -1 -- libs/personal-data
```
Expected: both show commits (the two prior plans are done and merged to `main`).

---

## Part 2: Tasks

### Task 1: Push `apps/personal-mcp` and let Vercel build it once (as a preview, no project yet)

**Files:** none (this task is verification-only, confirming the code is push-ready)

- [ ] **Step 1: Confirm the app builds cleanly from a fresh install**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
rm -rf apps/personal-mcp/node_modules libs/personal-data/node_modules node_modules
pnpm install
npx nx test personal-data
npx nx test personal-mcp
```
Expected: both pass, confirming there's no dependency resolution issue that only shows up in a clean install (this is exactly the kind of thing that differs between a local `node_modules` state and Vercel's fresh-clone build).

- [ ] **Step 2: Push to `main` (or open a PR if you want CI green first — this repo's existing convention per `gh pr checks` usage earlier in this project)**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git push origin main
```

---

### Task 2: Create the new Vercel project for `apps/personal-mcp`

This is a manual dashboard step — Vercel's GitHub integration auto-deploys pushes to *existing* projects, but a brand-new app in an already-connected monorepo needs to be explicitly imported once so Vercel knows to create a project scoped to its directory.

- [ ] **Step 1: In the Vercel dashboard, add a new project**

Navigate to `https://vercel.com/new`, select the `rainforest-dev/rainforest-monorepo` repository (already connected), and when prompted for **Root Directory**, set it to `apps/personal-mcp`.

- [ ] **Step 2: Confirm framework detection**

Vercel should auto-detect **Hono** as the framework (confirmed via Vercel's own docs during this project's design phase — a default-exported Hono app at `src/index.ts` is a recognized zero-config pattern). If it doesn't auto-detect, manually select "Hono" from the framework dropdown before deploying.

- [ ] **Step 3: Deploy**

Click Deploy. Wait for the build to complete.

- [ ] **Step 4: Verify on the assigned `*.vercel.app` URL**

Note the deployment's own preview URL from the dashboard (e.g. `personal-mcp-xxxxx.vercel.app`), then:

```bash
curl -s -X POST https://<the-vercel-app-url>/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
Expected: same SSE-framed `tools/list` response verified locally in `2026-07-07-personal-mcp-app.md` Task 4. If this 401s with a Vercel SSO redirect, that's Vercel's Deployment Protection on preview URLs (expected — this project's earlier Task 6 investigation hit the same thing) — check the *production* alias URL instead (also shown in the dashboard, of the form `personal-mcp-<team>.vercel.app` or similar, distinct from the per-deployment hash URL).

---

### Task 3: Move the `mcp.rainforest.tools` domain

**This is the step with the propagation-gap risk noted in the spec (§8) — do it during a low-traffic window, and don't proceed to Task 4 (removing the old code) until this is confirmed live.**

- [ ] **Step 1: Remove the domain from the `personal-website` project**

In the Vercel dashboard: `personal-website` project → Settings → Domains → find `mcp.rainforest.tools` → Remove.

- [ ] **Step 2: Add the domain to the `personal-mcp` project**

In the Vercel dashboard: `personal-mcp` project → Settings → Domains → Add → enter `mcp.rainforest.tools` → follow any DNS confirmation prompt (should be none — the CNAME already points at Vercel from the original Task 6 setup, this is purely a project reassignment, not new DNS).

- [ ] **Step 3: Wait for domain verification, then test**

```bash
curl -s -X POST https://mcp.rainforest.tools/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
Expected: `HTTP 200` with the real `tools/list` response. If it 404s or 302-redirects (the old failure modes from this project's earlier Task 6 investigation), wait a few minutes for Vercel's domain verification/cert issuance and retry — do **not** proceed to Task 4 until this returns the correct tools list.

- [ ] **Step 4: Spot-check a couple more calls against the live domain**

```bash
curl -s -X POST https://mcp.rainforest.tools/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_work_experience","arguments":{"technology":"auth0"}}}'

curl -s -X POST https://mcp.rainforest.tools/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"profile://project/en/opencgt"}}'
```
Expected: both return correct, real data (the CodeGreen job for the first, the OpenCGT project for the second).

---

### Task 4: Remove the dead MCP code from `apps/personal-website`

**Files:**
- Delete: `apps/personal-website/src/pages/api/mcp.ts`
- Delete: `apps/personal-website/vercel.json`
- Modify: `apps/personal-website/package.json` (remove `mcp-handler`, `@modelcontextprotocol/sdk`)

Only do this after Task 3 confirms `mcp.rainforest.tools` is fully live on the new project — until then, `apps/personal-website`'s old route is a harmless, unreferenced fallback (nothing points at it once the domain moved), not something blocking this cleanup, but there's no reason to rush it ahead of confirmed cutover.

- [ ] **Step 1: Delete the route and rewrite config**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git rm apps/personal-website/src/pages/api/mcp.ts
git rm apps/personal-website/vercel.json
```

- [ ] **Step 2: Remove the now-unused dependencies**

Edit `apps/personal-website/package.json`, remove these two lines from `"dependencies"`:
```
    "@modelcontextprotocol/sdk": "^1.29.0",
    "mcp-handler": "^1.1.0",
```

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && pnpm install`
Expected: lockfile updates, no errors.

- [ ] **Step 3: Verify the site still builds without the removed route**

Run: `cd /Users/rainforest/Repositories/rainforest-monorepo && npx nx build personal-website`
Expected: succeeds — the site never linked to `/api/mcp` from any page, so nothing else references it.

- [ ] **Step 4: Verify `rainforest.tools` itself is unaffected**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://rainforest.tools/
```
Expected: `302` (the normal locale-redirect behavior, same as the healthy state confirmed during this project's Task 6 outage investigation) — this change only touched files with no other consumers, so this is a sanity check, not expected to find anything.

- [ ] **Step 5: Commit**

```bash
cd /Users/rainforest/Repositories/rainforest-monorepo
git add -A
git commit -m "$(cat <<'EOF'
chore(personal-website): remove decommissioned MCP route

mcp.rainforest.tools is now served entirely by apps/personal-mcp, its
own Vercel project. This app's copy of the route, its vercel.json
host-conditional rewrite (which never reliably fired — see
2026-07-07-personal-mcp-split-design.md §1), and the mcp-handler/
@modelcontextprotocol/sdk dependencies are no longer needed here.

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

### Task 5: Verify with a real MCP client

This is Task 7 from the original `2026-07-04-personal-context-mcp.md` plan, finally reachable now that the domain is stable.

- [ ] **Step 1: Add the remote MCP server to a real client config**

In Claude Code (or Claude.ai's remote MCP connection settings), add:
```json
{
  "mcpServers": {
    "personal-context": {
      "url": "https://mcp.rainforest.tools"
    }
  }
}
```

- [ ] **Step 2: Confirm tool discovery**

In a fresh session with that MCP server connected, ask the client to list available tools. Expected: `get_profile_summary`, `get_work_experience`, `get_education`, `get_projects`, `get_skills`, `search_by_technology` all appear.

- [ ] **Step 3: Confirm a real tool call end-to-end**

Ask the client something that requires calling `get_work_experience` or `get_profile_summary` (e.g. "what's Rainforest's professional background?"). Expected: the client actually invokes the tool (not just answers from its own knowledge) and the response reflects the real resolved data (CodeGreen, Jubo, etc.).

---

## Part 3: Definition of done

- [ ] `apps/personal-mcp` is deployed as its own Vercel project.
- [ ] `mcp.rainforest.tools` resolves to `apps/personal-mcp` and returns correct `tools/list`, `tools/call`, and `resources/read` responses directly at the domain root.
- [ ] `apps/personal-website` no longer contains any MCP-specific code, `vercel.json`, or MCP dependencies, and still builds/deploys normally.
- [ ] A real MCP client (Claude Code or Claude.ai) successfully discovers and calls tools against `https://mcp.rainforest.tools`.
- [ ] Original plan's Task 6 and Task 7 (in `docs/superpowers/plans/2026-07-04-personal-context-mcp.md`) can both be marked complete.
