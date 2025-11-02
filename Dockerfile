# ==========================================
# 🚀 Multi-Stage Dockerfile for PoGoSDex
# Fully Tailwind v4+ compatible + Railway safe
# ==========================================

# === Stage 1: Build ===
FROM node:22-alpine AS build
WORKDIR /app

# Disable husky hooks during build
ENV HUSKY=0

# Copy minimal files first (better cache)
COPY package.json package-lock.json ./

# Install dependencies (with devDeps)
RUN npm ci --include=dev --no-audit

# Copy all source files
COPY . .

# === Build Tailwind (official v4+ CLI method) ===
RUN set -e \
    && echo "🎨 Building Tailwind (official @tailwindcss/cli)..." \
    && if ! npm list @tailwindcss/cli >/dev/null 2>&1; then \
    echo "⚙️ Installing @tailwindcss/cli (official Tailwind v4+ CLI)"; \
    npm install @tailwindcss/cli --save-dev --no-audit; \
    fi \
    && echo "🚀 Running Tailwind via official CLI..." \
    && npx --yes @tailwindcss/cli -i ./public/styles.css -o ./public/output.css --minify

# Remove devDependencies for smaller runtime image
RUN npm prune --production


# === Stage 2: Runtime ===
FROM node:22-alpine AS runtime
WORKDIR /app

# Copy only the production artifacts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Copy built static assets, server, and data
COPY --from=build /app/public ./public
COPY --from=build /app/server ./server
# COPY --from=build /app/data ./data
COPY --from=build /app/lang ./lang
COPY --from=build /app/external ./external

# Runtime config
ENV NODE_ENV=production
EXPOSE 3000

# Start the server
CMD ["node", "server/server.js"]
