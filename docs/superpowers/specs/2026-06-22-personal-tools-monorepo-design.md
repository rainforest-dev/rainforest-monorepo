# Personal Tools Monorepo — Architecture Design

**Date:** 2026-06-22
**Status:** approved
**Scope:** Adding `rss-manager` and `auth-service` to `rainforest-monorepo`; defining the homelab deployment architecture for all personal tools

---

## 1. Goals & Constraints

- Add `rss-manager` (currently a vanilla HTML+Python tool in the Obsidian vault) as a proper monorepo app
- Protect all homelab personal tools with passkey (WebAuthn) auth — single sign-on across tools
- **One Vercel app** — `personal-website` stays on Vercel; all other tools run on the homelab
- **Two repos stay decoupled** — `rainforest-monorepo` and `rainforest-obsidian` never reference each other in code; the only link is a runtime filesystem mount via env var
- No micro frontend runtime composition — separate subdomains give independent deployment naturally; monorepo value is shared libs and build orchestration

---

## 2. Domain Layout

```
rainforest.tools              → Vercel (personal-website, Astro, public)
auth.rainforest.tools         → Homelab, Traefik (auth-service)
calibre.rainforest.tools      → Homelab, Traefik (personal-calibre)
rss.rainforest.tools          → Homelab, Traefik (rss-manager)
<future>.rainforest.tools     → Homelab, Traefik (one router label per new app)
```

DNS split: `rainforest.tools` A/CNAME managed by Vercel; `*.rainforest.tools` points to homelab IP via Cloudflare Tunnel or dynamic DNS + port 443 forwarding.

`personal-website` has a `/tools` page linking to homelab subdomains — the only integration point between the two repos.

---

## 3. Monorepo Structure

```
apps/
  personal-website/    ← Astro, Vercel (existing)
  personal-calibre/    ← Next.js + SQLite, homelab (existing)
  personal-liff/       ← Next.js + LINE LIFF (existing)
  rss-manager/         ← NEW: Astro SSR + React islands, homelab
  auth-service/        ← NEW: Astro SSR, homelab
libs/
  rainforest-ui/       ← shared component library (existing)
```

---

## 4. App Stacks

### `rss-manager`

| Concern | Choice |
|---------|--------|
| Framework | Astro SSR (`@astrojs/node` adapter) |
| UI | React islands (interactive RSS table, feed validator) |
| API routes | `src/pages/api/` — reads Obsidian registry files |
| Vault access | `VAULT_PATH` env var → mounted read-only volume at `/vault` |
| Shared UI | `rainforest-ui` for primitives; custom dark theme stays in-app |
| Build | Nx + Vite (existing monorepo infrastructure) |

```
apps/rss-manager/
  src/
    pages/
      index.astro             ← main UI shell
      api/
        sources.ts            ← reads $VAULT_PATH/RSS-Source-Registry.md
        topics.ts             ← reads $VAULT_PATH/RSS-Topic-Registry.md
        tags.ts               ← reads $VAULT_PATH/Tag-Taxonomy.md
    components/
      SourceTable.tsx          ← React island
      FeedValidator.tsx        ← React island
  astro.config.mjs
```

File reading is server-side in API routes. No database — registry markdown files are the source of truth.

### `auth-service`

| Concern | Choice |
|---------|--------|
| Framework | Astro SSR (`@astrojs/node` adapter) |
| Passkey | `@simplewebauthn/server` (server) + `@simplewebauthn/browser` (client) |
| Session | Signed HTTP-only JWT cookie on `.rainforest.tools`, 7-day rolling |
| Credential store | SQLite via `better-sqlite3` (one `credentials` table) |
| Registration gate | `REGISTRATION_TOKEN` env var — must pass `?token=` to access `/register` |

```
apps/auth-service/
  src/
    pages/
      login.astro              ← passkey login page
      register.astro           ← one-time setup (token-gated)
      api/
        verify.ts              ← GET: Traefik ForwardAuth endpoint
        login/
          begin.ts             ← POST: generate WebAuthn challenge
          finish.ts            ← POST: verify assertion, set cookie
        register/
          begin.ts
          finish.ts
        logout.ts              ← POST: clear cookie
  db/
    schema.sql
```

**Session cookie:**
```
Name:     rf_session
Domain:   .rainforest.tools
HttpOnly: true
Secure:   true
SameSite: Lax
Max-Age:  7 days (rolling — refreshed on each /verify pass)
```

**SQLite schema:**
```sql
CREATE TABLE credentials (
  id          TEXT PRIMARY KEY,  -- WebAuthn credential ID (base64url)
  public_key  TEXT NOT NULL,     -- COSE public key
  counter     INTEGER NOT NULL,  -- signature counter (replay attack prevention)
  transports  TEXT,              -- JSON array of authenticator transports
  created_at  INTEGER NOT NULL
);
```

Sessions are stateless JWT signed with `JWT_SECRET` — no sessions table needed.

---

## 5. Auth Flow

```
1. User visits calibre.rainforest.tools
2. Traefik → GET auth.rainforest.tools/verify (no cookie) → 401
3. Traefik redirects → auth.rainforest.tools/login?redirect=https://calibre.rainforest.tools
4. User completes passkey on login page
5. Auth service sets rf_session cookie on .rainforest.tools
6. Auth service redirects → calibre.rainforest.tools
7. Traefik → GET auth.rainforest.tools/verify (cookie present) → 200
8. Request routes to personal-calibre app

Subsequent visits to rss.rainforest.tools or any homelab subdomain:
→ Cookie already present → /verify returns 200 immediately → SSO
```

---

## 6. Traefik & Docker Compose

**ForwardAuth middleware (defined once):**
```yaml
middlewares:
  homelab-auth:
    forwardAuth:
      address: "http://auth-service:3001/verify"
      trustForwardHeader: true
```

**Docker Compose:**
```yaml
services:
  traefik:
    image: traefik:v3
    ports: ["80:80", "443:443"]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./traefik/certs:/certs

  auth-service:
    build: ./apps/auth-service
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - REGISTRATION_TOKEN=${REGISTRATION_TOKEN}
    volumes:
      - auth-data:/app/db
    labels:
      - "traefik.http.routers.auth.rule=Host(`auth.rainforest.tools`)"
      # no homelab-auth middleware — auth-service IS the gate

  personal-calibre:
    build: ./apps/personal-calibre
    volumes:
      - calibre-data:/app/db
    labels:
      - "traefik.http.routers.calibre.rule=Host(`calibre.rainforest.tools`)"
      - "traefik.http.routers.calibre.middlewares=homelab-auth"

  rss-manager:
    build: ./apps/rss-manager
    environment:
      - VAULT_PATH=/vault
    volumes:
      - "${VAULT_PATH}/_system:/vault:ro"
    labels:
      - "traefik.http.routers.rss.rule=Host(`rss.rainforest.tools`)"
      - "traefik.http.routers.rss.middlewares=homelab-auth"

volumes:
  auth-data:
  calibre-data:
```

**Adding a future tool:** one new service block + two Traefik labels. Auth coverage is automatic.

---

## 7. Vault ↔ Monorepo Decoupling

The two repos never reference each other in code or config. The only connection is a runtime filesystem mount:

- Dev (Mac): `VAULT_PATH=~/Library/Mobile\ Documents/iCloud~md~obsidian/Documents/rainforest-obsidian`
- Docker: `volumes: ["${VAULT_PATH}/_system:/vault:ro"]`

Registry files are read-only from rss-manager's perspective. Edits happen in Obsidian; the app picks up changes on the next request. No sync, no git submodules, no API contract.

---

## 8. Out of Scope

- `personal-liff` deployment (LINE mini-app has separate hosting requirements)
- CI/CD pipeline changes (existing Nx affected builds cover new apps automatically)
- Obsidian vault git workflow changes
- Multi-user auth (single-user only — one passkey credential)
- Moving `personal-website` off Vercel
