# Contexte de build : racine du monorepo (voir docker-compose.yml).
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w @hope/api --omit=dev && npm cache clean --force

COPY packages/shared packages/shared
COPY apps/api apps/api

# Utilisateur non privilegie (fourni par l'image node) ; seul le dossier des images
# televersees lui appartient (le volume backend_uploads herite de ces droits a sa creation).
RUN mkdir -p apps/api/uploads apps/api/private-uploads && chown -R node:node apps/api/uploads apps/api/private-uploads

WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV PORT=5000
# Version deployee (journaux, Sentry) : docker build --build-arg GIT_SHA=$(git rev-parse --short HEAD)
ARG GIT_SHA=dev
ENV SENTRY_RELEASE=$GIT_SHA
EXPOSE 5000

USER node

# Sonde de sante sans curl (absent d'alpine) : fetch natif de Node.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
