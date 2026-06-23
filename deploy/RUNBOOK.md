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

1. Create `apps/<name>/Dockerfile` — use the `pnpm deploy --prod` pattern from `apps/auth-service/Dockerfile` or `apps/rss-manager/Dockerfile` (pnpm workspaces use symlinks; `pnpm deploy --prod /deploy` creates a self-contained flat `node_modules` the runtime image can use)
2. Add a service block in `deploy/docker-compose.yml`:
   ```yaml
   <name>:
     build:
       context: ..                              # monorepo root
       dockerfile: apps/<name>/Dockerfile
     restart: unless-stopped
     networks:
       - traefik
     labels:
       - "traefik.enable=true"
       - "traefik.http.routers.<name>.rule=Host(`<name>.rainforest.tools`)"
       - "traefik.http.routers.<name>.tls.certresolver=letsencrypt"
       - "traefik.http.routers.<name>.middlewares=homelab-auth@file"  # @file required for cross-provider refs
   ```
3. Add a `<name>.rainforest.tools` DNS record in Cloudflare (CNAME → homelab IP)
4. Run: `docker compose up -d <name>`
