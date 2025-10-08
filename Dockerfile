FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production
COPY server ./server
COPY public ./public
COPY data ./data
COPY lang ./lang
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","server/server.js"]
