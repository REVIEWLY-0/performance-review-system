# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY prisma ./prisma/
RUN npx prisma@5.22.0 generate

COPY . .
RUN npm run build

# ── Stage 2: Production runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev --legacy-peer-deps && npx prisma@5.22.0 generate

COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["sh", "-c", "npx prisma@5.22.0 migrate deploy && node dist/main.js"]