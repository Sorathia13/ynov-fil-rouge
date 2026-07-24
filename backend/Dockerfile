# ---- SmartBooking API — multi-stage production image ----

# 1) Build stage: install all deps, generate Prisma client, compile TypeScript
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 2) Production deps stage: only production node_modules + Prisma client
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# 3) Runtime stage: minimal image, non-root user
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# dumb-init for correct signal handling (graceful shutdown)
RUN apk add --no-cache dumb-init
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
# Run pending migrations then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
