FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace manifests for dependency install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/auth-service/package.json apps/auth-service/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @rainforest-monorepo/auth-service... --frozen-lockfile

COPY apps/auth-service apps/auth-service
RUN pnpm --filter @rainforest-monorepo/auth-service run build

# Deploy stage: create a self-contained deployment bundle via pnpm deploy
RUN pnpm --filter @rainforest-monorepo/auth-service deploy --prod /deploy

# Runtime image
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=base /deploy/node_modules ./node_modules
COPY --from=base /app/apps/auth-service/dist ./dist

RUN mkdir -p /app/db

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

CMD ["node", "./dist/server/entry.mjs"]
