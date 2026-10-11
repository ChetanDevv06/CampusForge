# CampusForge verification backend (self-hosted HTTP transport).
#
# Builds the trusted backend as a Node container that can run on Render,
# Railway, Fly.io, Cloud Run or any VPS — no Firebase Blaze plan required.
#
#   docker build -f functions/Dockerfile -t campusforge-verify .
#   docker run -p 8080:8080 \
#     -e GOOGLE_APPLICATION_CREDENTIALS=/secrets/service-account.json \
#     campusforge-verify

FROM node:20-slim

WORKDIR /app

# Install dependencies in the functions workspace.
COPY functions/package.json functions/package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Build (typescript is a dev dependency, so restore it first).
RUN npm install --no-save typescript
COPY functions/tsconfig.json ./
COPY functions/src ./src
RUN npx tsc

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080
CMD ["node", "lib/server/index.js"]
