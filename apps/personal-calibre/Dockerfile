FROM node:24-alpine
WORKDIR /app

COPY dist/artifacts/personal-calibre /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/personal-calibre/server.js"]
