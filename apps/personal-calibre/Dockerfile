FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace manifests and root tsconfig for dependency install + build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/personal-calibre/package.json apps/personal-calibre/
COPY libs/rainforest-ui/package.json libs/rainforest-ui/

# Install only personal-calibre's dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @rainforest-monorepo/personal-calibre... --frozen-lockfile

# Copy source and build
# The app's tsconfig references rainforest-ui, so its tsconfigs must exist for the build.
COPY libs/rainforest-ui/tsconfig*.json libs/rainforest-ui/
# The shared theme is a Tailwind plugin resolved from rainforest-ui's dist. Emit only
# that entry: the full library build needs the root toolchain, which this image omits.
# --rootDir pins the output to dist/tailwindcss/shadcn.js, the path package.json exports.
COPY libs/rainforest-ui/src/tailwindcss/shadcn.ts libs/rainforest-ui/src/tailwindcss/
RUN pnpm --filter @rainforest-monorepo/personal-calibre exec tsc \
    ../../libs/rainforest-ui/src/tailwindcss/shadcn.ts \
    --rootDir ../../libs/rainforest-ui/src/tailwindcss \
    --outDir ../../libs/rainforest-ui/dist/tailwindcss \
    --module esnext --target es2022 --moduleResolution bundler --skipLibCheck

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
