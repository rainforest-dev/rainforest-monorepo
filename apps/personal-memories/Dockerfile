FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/personal-memories/package.json apps/personal-memories/
COPY libs/rainforest-ui/package.json libs/rainforest-ui/
COPY libs/rainforest-react/package.json libs/rainforest-react/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --filter @rainforest-monorepo/personal-memories... --frozen-lockfile

# The app's tsconfig references rainforest-ui, so its tsconfigs must exist for the build.
COPY libs/rainforest-ui/tsconfig*.json libs/rainforest-ui/
# The shared theme is a Tailwind plugin resolved from rainforest-ui's dist. Emit only
# that entry: the full library build needs the root toolchain, which this image omits.
# --rootDir pins the output to dist/tailwindcss/shadcn.js, the path package.json exports.
COPY libs/rainforest-ui/src/tailwindcss/shadcn.ts libs/rainforest-ui/src/tailwindcss/
RUN pnpm --filter @rainforest-monorepo/personal-memories exec tsc \
    ../../libs/rainforest-ui/src/tailwindcss/shadcn.ts \
    --rootDir ../../libs/rainforest-ui/src/tailwindcss \
    --outDir ../../libs/rainforest-ui/dist/tailwindcss \
    --module esnext --target es2022 --moduleResolution bundler --skipLibCheck

COPY libs/rainforest-ui/src/recipes libs/rainforest-ui/src/recipes
RUN pnpm --filter @rainforest-monorepo/personal-memories exec tsc \
    ../../libs/rainforest-ui/src/recipes/index.ts \
    --rootDir ../../libs/rainforest-ui/src/recipes \
    --outDir ../../libs/rainforest-ui/dist/recipes \
    --declaration --module esnext --target es2022 --moduleResolution bundler --skipLibCheck

COPY libs/rainforest-react libs/rainforest-react
RUN pnpm --filter @rainforest-dev/rainforest-react exec vite build

COPY apps/personal-memories apps/personal-memories
RUN pnpm --filter @rainforest-monorepo/personal-memories run build

# Create self-contained deployment bundle (resolves pnpm symlinks for runtime)
RUN pnpm --filter @rainforest-monorepo/personal-memories deploy --prod /deploy --legacy

# Runtime image
FROM node:22-alpine AS runtime
WORKDIR /app

COPY --from=base /deploy/node_modules ./node_modules
COPY --from=base /app/apps/personal-memories/dist ./dist

ENV NODE_ENV=production
# HOST overrides the 127.0.0.1 in astro.config.mjs, which exists to keep the dev
# server off the network. Inside the container the bind has to be 0.0.0.0 or the
# published port reaches nothing.
ENV HOST=0.0.0.0
ENV PORT=3004
EXPOSE 3004

# MEMORIES_DATA_DIR is supplied at run time and the timeline is read from it.
# Photo paths inside timeline.json are absolute host paths, so whatever holds
# them must be mounted at those same paths — read-only, except MEMORIES_NOTES_DIR,
# which must be writable.
CMD ["node", "./dist/server/entry.mjs"]
