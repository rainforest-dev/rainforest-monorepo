FROM node:24-alpine
WORKDIR /app

COPY dist/artifacts/library-hall /app

ENV NODE_ENV=production
ENV PORT=8087
EXPOSE 8087

CMD ["node", "apps/library-hall/server.js"]
