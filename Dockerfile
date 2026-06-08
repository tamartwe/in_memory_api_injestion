# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Installs all dependencies (including devDependencies) and compiles TypeScript
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
# Copies only the compiled JS and installs production dependencies only.
# Result is a lean image with no TypeScript toolchain or source files.
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
