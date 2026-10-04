FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/rss-manager/package.json apps/rss-manager/
COPY libs/rainforest-ui/package.json libs/rainforest-ui/
COPY libs/rainforest-react/package.json libs/rainforest-react/

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

COPY libs/rainforest-ui/src/recipes libs/rainforest-ui/src/recipes
RUN pnpm --filter @rainforest-monorepo/rss-manager exec tsc \
    ../../libs/rainforest-ui/src/recipes/index.ts \
    --rootDir ../../libs/rainforest-ui/src/recipes \
    --outDir ../../libs/rainforest-ui/dist/recipes \
    --declaration --module esnext --target es2022 --moduleResolution bundler --skipLibCheck

COPY libs/rainforest-ui/src/interaction libs/rainforest-ui/src/interaction
RUN pnpm --filter @rainforest-monorepo/rss-manager exec tsc \
    ../../libs/rainforest-ui/src/interaction/index.ts \
    --rootDir ../../libs/rainforest-ui/src/interaction \
    --outDir ../../libs/rainforest-ui/dist/interaction \
    --declaration --module esnext --target es2022 --moduleResolution bundler --skipLibCheck \
    --lib es2022,dom,dom.iterable

COPY libs/rainforest-react libs/rainforest-react
RUN pnpm --filter @rainforest-dev/rainforest-react exec vite build

COPY apps/rss-manager apps/rss-manager
RUN pnpm --filter @rainforest-monorepo/rss-manager run build

# `pnpm deploy --prod` would also ship the workspace root's next and astro's build toolchain.
WORKDIR /app/apps/rss-manager
RUN node --input-type=module -e "const { nodeFileTrace } = await import('@vercel/nft'); const { fileList } = await nodeFileTrace(['dist/server/entry.mjs'], { base: '/app' }); console.log([...fileList, 'apps/rss-manager/dist'].join('\n'));" > /tmp/runtime-files \
    && mkdir /deploy \
    && tar -C /app -cf - -T /tmp/runtime-files | tar -C /deploy -xf -

# Runtime image
FROM node:24-alpine AS runtime
WORKDIR /app/apps/rss-manager

COPY --from=base /deploy /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3002
EXPOSE 3002

CMD ["node", "./dist/server/entry.mjs"]
