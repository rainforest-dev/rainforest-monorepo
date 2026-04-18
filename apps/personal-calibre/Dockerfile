FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace manifests for dependency install
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/personal-calibre/package.json apps/personal-calibre/

# Install only personal-calibre's dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @rainforest-monorepo/personal-calibre... --frozen-lockfile

# Copy source and build
COPY apps/personal-calibre apps/personal-calibre
RUN pnpm --filter @rainforest-monorepo/personal-calibre exec next build

# Minimal runtime image
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=base /app/apps/personal-calibre/.next/standalone ./
COPY --from=base /app/apps/personal-calibre/.next/static ./apps/personal-calibre/.next/static
COPY --from=base /app/apps/personal-calibre/public ./apps/personal-calibre/public

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/personal-calibre/server.js"]
