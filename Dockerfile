# Builder stage: install dev deps and build Tailwind CSS
FROM node:22-alpine AS builder
WORKDIR /app

# Copy root package files so Tailwind (devDependency) can be installed
COPY package.json package-lock.json ./
RUN npm ci

# Copy only what's needed to build CSS
COPY tailwind.config.js ./
COPY public ./public

# Build output.css
RUN npx tailwindcss -i ./public/styles.css -o ./public/output.css --minify

# Final runtime image
FROM node:22-alpine AS runtime
WORKDIR /app

# Install server production deps
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy server code
COPY server ./server

# Copy built public assets from builder
COPY --from=builder /app/public ./public

# Copy data/lang as before
COPY data ./data
COPY lang ./lang

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","server/server.js"]
