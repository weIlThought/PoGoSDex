# Multi-stage build: install at repo root (workspaces-aware), build assets, runtime uses built artifacts

# Build stage: install deps at repo root and build Tailwind
FROM node:22-alpine AS build
WORKDIR /app

# Copy root package files so workspace deps are installed once
COPY package.json package-lock.json ./
RUN npm ci

# Copy all sources (so tailwind can read templates) and build CSS
COPY . .
RUN npx tailwindcss -i ./public/styles.css -o ./public/output.css --minify

# Runtime stage: use built node_modules and only needed files
FROM node:22-alpine AS runtime
WORKDIR /app

# Copy production deps and app files from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# copy public assets, server code and required data/lang/external folders
COPY --from=build /app/public ./public
COPY --from=build /app/server ./server
COPY --from=build /app/data ./data
COPY --from=build /app/lang ./lang
COPY --from=build /app/external ./external

ENV NODE_ENV=production
EXPOSE 3000

# Start server (adjust if your start script differs)
CMD ["node", "server/server.js"]
