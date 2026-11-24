FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/iot-simulator/package.json apps/iot-simulator/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --no-audit --no-fund
COPY packages/contracts/ packages/contracts/
COPY apps/api/ apps/api/
COPY apps/iot-simulator/ apps/iot-simulator/
RUN npm run db:generate && npm run build -w @semh/contracts && npm run build -w @semh/api && npm run build -w @semh/iot-simulator
FROM build AS frontend
COPY apps/web/ apps/web/
RUN npm run build -w @semh/web

FROM build AS production-dependencies
RUN npm prune --omit=dev --no-audit --no-fund

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3000
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/packages/contracts ./packages/contracts
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/iot-simulator ./apps/iot-simulator
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@semh/api"]

FROM runtime AS production
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=frontend /app/apps/web/dist /app/apps/web/dist
COPY infra/ec2/start-production.mjs /app/start-production.mjs
ENV TRUST_PROXY=1
USER node
CMD ["node", "/app/start-production.mjs"]

FROM runtime AS api
