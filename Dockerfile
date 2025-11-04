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

## === Build assets ===
# Build public CSS (Tailwind) and admin CSS
RUN set -e \
    && echo "🎨 Building Tailwind CSS..." \
    && npx --yes @tailwindcss/cli -i ./public/styles.css -o ./public/output.css --minify \
    && echo "🛠  Building Admin CSS..." \
    && npx --yes @tailwindcss/cli -i ./server/admin/styles.css -o ./server/admin/admin.css --minify

# Vite multi-page build to dist/
RUN echo "📦 Building frontend with Vite..." \
    && npm run build

# Copy static assets required at runtime into dist (favicon, images, css)
RUN set -e \
    && mkdir -p ./dist/assets \
    && if [ -d ./public/assets ]; then cp -r ./public/assets/* ./dist/assets/; fi \
    && if [ -f ./public/output.css ]; then cp ./public/output.css ./dist/output.css; fi \
    && if [ -f ./public/fonts.css ]; then cp ./public/fonts.css ./dist/fonts.css; fi

# Remove devDependencies for smaller runtime image
RUN npm prune --production


# === Stage 2: Runtime ===
FROM node:22-alpine AS runtime
WORKDIR /app

# Copy only the production artifacts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Copy built static assets, server, and data
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
# COPY --from=build /app/data ./data
COPY --from=build /app/lang ./lang
# COPY --from=build /app/external ./external

# Runtime config
ENV NODE_ENV=production
EXPOSE 3000

# Run as non-root user for security
USER node

# Healthcheck using Node fetch (no curl needed)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start the server
CMD ["node", "server/server.js"]
