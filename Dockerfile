FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# Read at runtime with fs (dynamic paths, not traced): copy explicitly.
COPY --from=build /app/livreur.json ./livreur.json
COPY --from=build /app/data ./data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
