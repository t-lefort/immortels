# Stage 1: Build client
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDeps needed for Vite build)
RUN npm ci --include=dev

# Copy client source and Vite config
COPY client/ ./client/
COPY client/vite.config.js ./client/vite.config.js

# Build the frontend
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy server source
COPY server/ ./server/

# Copy built client from build stage
COPY --from=build /app/client/dist ./client/dist

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/game/health || exit 1

CMD ["node", "server/index.js"]
