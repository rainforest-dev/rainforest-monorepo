# Homelab Deployment (Docker Compose + Traefik) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `auth-service`, `rss-manager`, and `personal-calibre` behind a single Traefik reverse proxy with Let's Encrypt wildcard TLS and a single ForwardAuth middleware that gates all homelab subdomains with the `rf_session` passkey cookie.

**Architecture:** A `deploy/` directory in the monorepo root contains `docker-compose.yml`, Traefik static config, and a dynamic config file for the shared `homelab-auth` ForwardAuth middleware. All services share a `traefik` Docker network. `auth-service` is the only service WITHOUT the middleware — it IS the gate.

**Prerequisites:**
- Plan 1 (auth-service) complete — Docker image must build
- Plan 2 (rss-manager) complete — Docker image must build
- Cloudflare API token with `Zone.DNS` edit permission (for Let's Encrypt DNS challenge)
- `*.rainforest.tools` DNS wildcard pointing to homelab IP (via Cloudflare)

**Spec:** `docs/superpowers/specs/2026-06-22-personal-tools-monorepo-design.md` §6 (Traefik & Docker Compose)

---

## File Map

```
deploy/
  docker-compose.yml             ← all services + Traefik
  .env.example                   ← required env vars with instructions
  traefik/
    traefik.yml                  ← Traefik static config
    dynamic/
      middlewares.yml            ← homelab-auth ForwardAuth middleware definition
```

---

### Task 1: Directory structure + Traefik static config

**Files:**
- Create: `deploy/traefik/traefik.yml`
- Create: `deploy/traefik/dynamic/.gitkeep`

- [ ] **Step 1: Create the `deploy/` directory structure**

```bash
mkdir -p ~/Repositories/rainforest-monorepo/deploy/traefik/dynamic
touch ~/Repositories/rainforest-monorepo/deploy/traefik/dynamic/.gitkeep
```

- [ ] **Step 2: Create `deploy/traefik/traefik.yml`**

```yaml
# Traefik v3 static configuration
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"

# Let's Encrypt via Cloudflare DNS challenge — gets a wildcard cert for *.rainforest.tools
certificatesResolvers:
  letsencrypt:
    acme:
      email: contact@rainforest.tools
      storage: /letsencrypt/acme.json
      dnsChallenge:
        provider: cloudflare
        resolvers:
          - "1.1.1.1:53"
          - "8.8.8.8:53"

providers:
  docker:
    exposedByDefault: false
    network: traefik
  file:
    directory: /config/dynamic
    watch: true

log:
  level: INFO

accessLog: {}
```

- [ ] **Step 3: Verify the file is valid YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('deploy/traefik/traefik.yml'))" && echo "OK"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd ~/Repositories/rainforest-monorepo
git add deploy/
git commit -m "feat(deploy): add deploy directory and Traefik static config"
```

---

### Task 2: Traefik dynamic config — ForwardAuth middleware

**Files:**
- Create: `deploy/traefik/dynamic/middlewares.yml`

The ForwardAuth middleware is defined once here and referenced by all protected services via Docker labels (`traefik.http.routers.<name>.middlewares=homelab-auth`). `auth-service` itself is NOT listed here — it has no middleware.

- [ ] **Step 1: Create `deploy/traefik/dynamic/middlewares.yml`**

```yaml
http:
  middlewares:
    homelab-auth:
      forwardAuth:
        address: "http://auth-service:3001/api/verify"
        # Pass original host/uri headers so /api/verify can build the redirect URL
        trustForwardHeader: true
        authResponseHeaders:
          - "X-Forwarded-User"
```

- [ ] **Step 2: Verify it's valid YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('deploy/traefik/dynamic/middlewares.yml'))" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add deploy/traefik/dynamic/middlewares.yml
git commit -m "feat(deploy): add homelab-auth ForwardAuth middleware"
```

---

### Task 3: docker-compose.yml

**Files:**
- Create: `deploy/docker-compose.yml`

Key rules:
- `auth-service` router has NO `middlewares=homelab-auth` label — it receives unauthenticated requests
- Every other service that should be protected MUST have `middlewares=homelab-auth`
- All services join the `traefik` network so Traefik can reach the ForwardAuth endpoint

- [ ] **Step 1: Create `deploy/docker-compose.yml`**

```yaml
networks:
  traefik:
    name: traefik

volumes:
  auth-data:
  calibre-data:
  letsencrypt:

services:
  traefik:
    image: traefik:v3
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      - CF_DNS_API_TOKEN=${CF_DNS_API_TOKEN}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/traefik.yml:/traefik.yml:ro
      - ./traefik/dynamic:/config/dynamic:ro
      - letsencrypt:/letsencrypt
    networks:
      - traefik
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.traefik-api.rule=Host(`traefik.rainforest.tools`)"
      - "traefik.http.routers.traefik-api.service=api@internal"
      - "traefik.http.routers.traefik-api.tls.certresolver=letsencrypt"
      - "traefik.http.routers.traefik-api.middlewares=homelab-auth"

  auth-service:
    build:
      context: ..
      dockerfile: apps/auth-service/Dockerfile
    restart: unless-stopped
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - REGISTRATION_TOKEN=${REGISTRATION_TOKEN}
      - WEBAUTHN_RP_ID=rainforest.tools
      - WEBAUTHN_ORIGIN=https://auth.rainforest.tools
      - COOKIE_DOMAIN=.rainforest.tools
    volumes:
      - auth-data:/app/db
    networks:
      - traefik
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.auth.rule=Host(`auth.rainforest.tools`)"
      - "traefik.http.routers.auth.tls.certresolver=letsencrypt"
      # intentionally NO homelab-auth middleware — auth-service is the auth gate itself

  personal-calibre:
    build:
      context: ..
      dockerfile: apps/personal-calibre/Dockerfile
    restart: unless-stopped
    environment:
      - CALIBRE_LIBRARY_PATH=/calibre
    volumes:
      - calibre-data:/app/db
      - ${CALIBRE_LIBRARY_PATH}:/calibre:ro
    networks:
      - traefik
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.calibre.rule=Host(`calibre.rainforest.tools`)"
      - "traefik.http.routers.calibre.tls.certresolver=letsencrypt"
      - "traefik.http.routers.calibre.middlewares=homelab-auth"

  rss-manager:
    build:
      context: ..
      dockerfile: apps/rss-manager/Dockerfile
    restart: unless-stopped
    environment:
      - VAULT_PATH=/vault
    volumes:
      - ${VAULT_REGISTRY_PATH}:/vault:ro
    networks:
      - traefik
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.rss.rule=Host(`rss.rainforest.tools`)"
      - "traefik.http.routers.rss.tls.certresolver=letsencrypt"
      - "traefik.http.routers.rss.middlewares=homelab-auth"
```

- [ ] **Step 2: Verify it's valid YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('deploy/docker-compose.yml'))" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Dry-run with docker compose config**

```bash
cd ~/Repositories/rainforest-monorepo/deploy

# Set minimal env vars for config parse
JWT_SECRET=dummy REGISTRATION_TOKEN=dummy CF_DNS_API_TOKEN=dummy \
CALIBRE_LIBRARY_PATH=/tmp VAULT_REGISTRY_PATH=/tmp \
docker compose config 2>&1 | head -50
```

Expected: rendered docker-compose config printed (no errors).

- [ ] **Step 4: Commit**

```bash
cd ~/Repositories/rainforest-monorepo
git add deploy/docker-compose.yml
git commit -m "feat(deploy): add docker-compose.yml with Traefik + all homelab services"
```

---

### Task 4: .env.example

**Files:**
- Create: `deploy/.env.example`

- [ ] **Step 1: Create `deploy/.env.example`**

```bash
# ── Required secrets ────────────────────────────────────────────────
# Generate with: openssl rand -hex 32
JWT_SECRET=

# Set on first deploy only. Visit https://auth.rainforest.tools/register?token=<this>
# to register your passkey. Then unset (or empty) this variable.
REGISTRATION_TOKEN=

# Cloudflare API token with Zone.DNS edit permission (for wildcard TLS cert)
CF_DNS_API_TOKEN=

# ── Required paths (host machine) ──────────────────────────────────
# Absolute path to your Calibre library directory
CALIBRE_LIBRARY_PATH=/path/to/Calibre Library

# Absolute path to the _system/ directory inside your Obsidian vault
# Example: /Users/you/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian/_system
VAULT_REGISTRY_PATH=/path/to/obsidian-vault/_system
```

- [ ] **Step 2: Verify `.env` is in `.gitignore`**

```bash
grep -q '\.env$' ~/Repositories/rainforest-monorepo/.gitignore && echo "OK" || echo "ADD .env to .gitignore"
```

If not found, add it:

```bash
echo '.env' >> ~/Repositories/rainforest-monorepo/.gitignore
```

- [ ] **Step 3: Commit**

```bash
cd ~/Repositories/rainforest-monorepo
git add deploy/.env.example .gitignore
git commit -m "feat(deploy): add .env.example for homelab deployment"
```

---

### Task 5: First-deploy runbook

This task documents the exact sequence for first-time deployment. It is not a code task — write it as a comment in `.env.example` or a separate `deploy/RUNBOOK.md`.

**Files:**
- Create: `deploy/RUNBOOK.md`

- [ ] **Step 1: Create `deploy/RUNBOOK.md`**

````markdown
# Homelab Deployment Runbook

## Prerequisites

1. Docker + Docker Compose installed on the homelab machine
2. Cloudflare managing DNS for `rainforest.tools`
3. `*.rainforest.tools` A record pointing to homelab IP
4. Ports 80 and 443 open on the router (forwarded to homelab)

## First Deploy

```bash
# 1. Clone the repo on the homelab machine
git clone https://github.com/rainforest-dev/rainforest-monorepo.git
cd rainforest-monorepo/deploy

# 2. Create .env from the example
cp .env.example .env
# Edit .env — fill in all required values

# 3. Generate secrets
openssl rand -hex 32   # paste as JWT_SECRET
openssl rand -hex 16   # paste as REGISTRATION_TOKEN (temporary)

# 4. Start all services (builds images on first run)
docker compose up -d

# 5. Register your passkey (one-time)
# Open https://auth.rainforest.tools/register?token=<REGISTRATION_TOKEN>
# Complete the passkey registration with your device
# Test login at https://auth.rainforest.tools/login

# 6. Disable registration (remove token)
# Edit .env: clear or remove REGISTRATION_TOKEN line
docker compose up -d auth-service   # restart to pick up the change

# 7. Verify SSO works
# Visit https://calibre.rainforest.tools — should redirect to auth, then back
# Visit https://rss.rainforest.tools — same SSO with existing cookie
```

## Day-2 Operations

```bash
# Update all services to latest images
git pull
docker compose up -d --build

# View logs for a specific service
docker compose logs -f auth-service

# Stop everything
docker compose down

# Restart a single service
docker compose restart rss-manager

# Check Traefik dashboard
# https://traefik.rainforest.tools (protected by homelab-auth)

# Renew TLS certs manually (auto-renews; this forces it)
docker compose restart traefik
```

## Adding a New Service

1. Add its Dockerfile to `apps/<name>/Dockerfile` (copy from auth-service pattern)
2. Add a service block in `deploy/docker-compose.yml` with:
   - `build.dockerfile: apps/<name>/Dockerfile`
   - `traefik.http.routers.<name>.rule=Host('<name>.rainforest.tools')`
   - `traefik.http.routers.<name>.tls.certresolver=letsencrypt`
   - `traefik.http.routers.<name>.middlewares=homelab-auth`
3. Add a `<name>.rainforest.tools` DNS record in Cloudflare (CNAME → homelab IP)
4. Run: `docker compose up -d <name>`
````

- [ ] **Step 2: Commit**

```bash
cd ~/Repositories/rainforest-monorepo
git add deploy/RUNBOOK.md
git commit -m "docs(deploy): add first-deploy and day-2 operations runbook"
```

---

### Task 6: End-to-end local smoke test

This task runs the full stack locally with self-signed TLS (skipping Let's Encrypt) to verify the wiring before deploying to the homelab. It uses `--override` to swap the cert resolver for a self-signed one.

**Files:**
- Create: `deploy/docker-compose.dev.yml` (override for local testing)

- [ ] **Step 1: Create `deploy/docker-compose.dev.yml`**

```yaml
# Local override: disable TLS cert resolver (HTTP only) for local smoke testing
# Usage: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
services:
  traefik:
    ports:
      - "8080:8080"     # expose dashboard on plain HTTP
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedByDefault=false"
      - "--providers.docker.network=traefik"
      - "--providers.file.directory=/config/dynamic"
      - "--entrypoints.web.address=:80"
    labels:
      - "traefik.enable=false"  # disable the routed dashboard in dev

  auth-service:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.auth.rule=Host(`auth.localhost`)"
      # no TLS in dev

  personal-calibre:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.calibre.rule=Host(`calibre.localhost`)"
      - "traefik.http.routers.calibre.middlewares=homelab-auth"

  rss-manager:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.rss.rule=Host(`rss.localhost`)"
      - "traefik.http.routers.rss.middlewares=homelab-auth"
```

- [ ] **Step 2: Add `*.localhost` entries to `/etc/hosts` for local testing**

```bash
grep -q 'auth.localhost' /etc/hosts || \
  echo "127.0.0.1 auth.localhost calibre.localhost rss.localhost" | sudo tee -a /etc/hosts
```

- [ ] **Step 3: Create a dev `.env` file**

```bash
cd ~/Repositories/rainforest-monorepo/deploy
cat > .env.dev << 'EOF'
JWT_SECRET=dev-secret-not-for-production-at-least-32-chars
REGISTRATION_TOKEN=devtoken
CF_DNS_API_TOKEN=unused-in-dev
CALIBRE_LIBRARY_PATH=/tmp
VAULT_REGISTRY_PATH=/Users/rainforest/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian/_system
EOF
```

Also update `WEBAUTHN_ORIGIN` and `WEBAUTHN_RP_ID` for local testing by extending the compose override:

```yaml
# Add to docker-compose.dev.yml under auth-service:
  auth-service:
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - REGISTRATION_TOKEN=${REGISTRATION_TOKEN}
      - WEBAUTHN_RP_ID=auth.localhost
      - WEBAUTHN_ORIGIN=http://auth.localhost
      - COOKIE_DOMAIN=.localhost
```

Update `deploy/docker-compose.dev.yml` to add this under `auth-service`.

- [ ] **Step 4: Run the dev stack**

```bash
cd ~/Repositories/rainforest-monorepo/deploy
env $(cat .env.dev | grep -v '#' | xargs) \
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

- [ ] **Step 5: Verify ForwardAuth flow**

```bash
# Without cookie — should redirect to auth login
curl -s -o /dev/null -w "%{http_code}" -H "Host: calibre.localhost" http://localhost/
# Expected: 302

# Direct hit to auth service — should show login page
curl -s -o /dev/null -w "%{http_code}" -H "Host: auth.localhost" http://localhost/
# Expected: 200

# /api/verify without cookie — should redirect to login
curl -s -o /dev/null -w "%{redirect_url}" -H "Host: auth.localhost" http://localhost/api/verify
# Expected: http://auth.localhost/login (or similar)
```

- [ ] **Step 6: Tear down dev stack**

```bash
cd ~/Repositories/rainforest-monorepo/deploy
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

- [ ] **Step 7: Commit**

```bash
cd ~/Repositories/rainforest-monorepo
git add deploy/docker-compose.dev.yml
git commit -m "feat(deploy): add dev compose override for local smoke testing"
```

---

## Self-Review Checklist (do not skip)

After all tasks complete, verify against spec §6:

- [ ] `docker compose config` parses without errors (with dummy env vars)
- [ ] `traefik.yml` has `certificatesResolvers.letsencrypt.acme.dnsChallenge.provider=cloudflare`
- [ ] `middlewares.yml` defines `homelab-auth` with `address: http://auth-service:3001/api/verify`
- [ ] `auth-service` router has NO `middlewares=homelab-auth` label
- [ ] `personal-calibre` and `rss-manager` routers both have `middlewares=homelab-auth`
- [ ] `.env.example` lists all 5 required variables with instructions
- [ ] `RUNBOOK.md` covers first deploy + day-2 operations + adding a new service
- [ ] Dev smoke test: unauthenticated request to `calibre.localhost` redirects to `auth.localhost/login`
