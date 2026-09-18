FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/rss-manager/package.json apps/rss-manager/
COPY libs/rainforest-ui/package.json libs/rainforest-ui/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @rainforest-monorepo/rss-manager... --frozen-lockfile

# The app's tsconfig references rainforest-ui, so its tsconfigs must exist for the build.
COPY libs/rainforest-ui/tsconfig*.json libs/rainforest-ui/
# The shared theme is a Tailwind plugin resolved from rainforest-ui's dist. Emit only
# that entry: the full library build needs the root toolchain, which this image omits.
# --rootDir pins the output to dist/tailwindcss/shadcn.js, the path package.json exports.
COPY libs/rainforest-ui/src/tailwindcss/shadcn.ts libs/rainforest-ui/src/tailwindcss/
RUN pnpm --filter @rainforest-monorepo/rss-manager exec tsc \
    ../../libs/rainforest-ui/src/tailwindcss/shadcn.ts \
    --rootDir ../../libs/rainforest-ui/src/tailwindcss \
    --outDir ../../libs/rainforest-ui/dist/tailwindcss \
    --module esnext --target es2022 --moduleResolution bundler --skipLibCheck

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
