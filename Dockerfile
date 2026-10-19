# Pin bun so a new release can't silently break the build/runtime
ARG BUN_VERSION=1.3

FROM oven/bun:${BUN_VERSION} AS bun

# Stage 1: Install dependencies
# pnpm needs a real Node.js (bun's `node` shim is not a drop-in replacement)
FROM node:22-slim AS deps

# bun is still needed to build the server
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

# Install the pnpm version pinned in package.json's packageManager field
RUN corepack enable

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all package.json files to install dependencies
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Build shared package
FROM deps AS shared-build

WORKDIR /app

# Copy shared package source
COPY packages/shared packages/shared

# Build shared package
RUN pnpm --filter @nofus/shared build

# Stage 3: Build frontend
FROM shared-build AS web-build

WORKDIR /app

# Copy web app source
COPY apps/web apps/web

# Build frontend
RUN pnpm --filter @nofus/web build

# Stage 4: Build backend
FROM shared-build AS server-build

WORKDIR /app

# Copy server source
COPY apps/server apps/server

# Build backend
RUN pnpm --filter @nofus/server build

# Stage 5: Production runtime
FROM oven/bun:${BUN_VERSION}-slim AS runtime

WORKDIR /app

# Copy built backend
COPY --from=server-build /app/apps/server/dist ./dist

# Copy built frontend to public directory
COPY --from=web-build /app/apps/web/dist ./public

# Copy built shared package
COPY --from=shared-build /app/packages/shared/dist ./node_modules/@nofus/shared/dist
COPY --from=shared-build /app/packages/shared/package.json ./node_modules/@nofus/shared/

# Set environment variables
ENV NODE_ENV=production
ENV STATIC_DIR=/app/public
ENV PORT=3000

# Expose port
EXPOSE 3000

# Run the server
CMD ["bun", "run", "/app/dist/index.js"]
