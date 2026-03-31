# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies (including dev — needed for tsc + prisma generate)
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client (architecture-specific binaries)
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source and compile TypeScript → dist/
COPY . .
RUN npm run build

# ── Stage 2: Production runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies only, then regenerate Prisma client
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev --legacy-peer-deps && npx prisma generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 4000

# Run pending migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
