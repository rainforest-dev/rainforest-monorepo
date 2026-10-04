FROM node:24-alpine
WORKDIR /app/apps/personal-memories

COPY dist/artifacts/personal-memories /app

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
