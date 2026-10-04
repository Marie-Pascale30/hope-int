# Contexte de build : racine du monorepo (voir docker-compose.yml).
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w @hope/api --omit=dev

COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
