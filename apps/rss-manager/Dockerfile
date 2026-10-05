FROM node:24-alpine
WORKDIR /app/apps/rss-manager

COPY dist/artifacts/rss-manager /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3002
EXPOSE 3002

CMD ["node", "./dist/server/entry.mjs"]
