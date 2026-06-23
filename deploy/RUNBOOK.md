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
