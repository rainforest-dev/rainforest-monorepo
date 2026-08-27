FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/loop-observatory/package.json apps/loop-observatory/
COPY libs/rainforest-ui/package.json libs/rainforest-ui/

# Two caches, because pnpm keeps two. The store holds tarballs; publish-time
# metadata lives in ~/.cache/pnpm/v11/metadata, and `minimumReleaseAge` in
# pnpm-workspace.yaml needs that metadata for all 3085 lockfile entries. Cache
# only the store and every build re-fetches all 3085 — measured at 5m 32s with
# the store fully warm and zero tarballs downloaded.
#
# --prefer-offline then reads that cached metadata instead of revalidating it.
# The supply-chain check still runs: publish times are immutable, so a cached
# document answers `minimumReleaseAge` with the same value the network would.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=cache,id=pnpm-meta,target=/root/.cache/pnpm \
    pnpm install --filter @rainforest-monorepo/loop-observatory... \
      --frozen-lockfile --prefer-offline

COPY libs/rainforest-ui libs/rainforest-ui
COPY apps/loop-observatory apps/loop-observatory

# Build the shadcn tailwind plugin the app's app.css imports, then the app.
RUN pnpm exec nx build rainforest-ui
RUN pnpm --filter @rainforest-monorepo/loop-observatory run build

# Create self-contained deployment bundle (resolves pnpm symlinks for runtime)
RUN pnpm --filter @rainforest-monorepo/loop-observatory deploy --prod /deploy --legacy

# Runtime image
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=base /deploy/node_modules ./node_modules
COPY --from=base /app/apps/loop-observatory/dist ./dist

# Host declarations ship WITH the image, not mounted: they are generic config, so
# a declaration change is a release. Outside a container the app resolves this
# relative to the working directory, which only launchd was setting.
COPY tools/loop/hosts.yaml ./tools/loop/hosts.yaml
ENV LOOP_HOSTS_YAML=/app/tools/loop/hosts.yaml

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3003
# VAULT_PATH must be provided at runtime. The vault is mounted READ-WRITE:
# task decisions, task notes, the greenlight outbox and the enrollment store all
# write into it.
EXPOSE 3003

CMD ["node", "./dist/server/entry.mjs"]
