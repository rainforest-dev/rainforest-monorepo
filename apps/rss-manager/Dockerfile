FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/rss-manager/package.json apps/rss-manager/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @rainforest-monorepo/rss-manager... --frozen-lockfile

COPY apps/rss-manager apps/rss-manager
RUN pnpm --filter @rainforest-monorepo/rss-manager run build

# Create self-contained deployment bundle (resolves pnpm symlinks for runtime)
RUN pnpm --filter @rainforest-monorepo/rss-manager deploy --prod /deploy --legacy

# Runtime image
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=base /deploy/node_modules ./node_modules
COPY --from=base /app/apps/rss-manager/dist ./dist

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3002
EXPOSE 3002

CMD ["node", "./dist/server/entry.mjs"]
