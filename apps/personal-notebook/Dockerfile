FROM node:24-alpine
WORKDIR /app

COPY dist/artifacts/personal-notebook /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/personal-notebook/server.js"]
