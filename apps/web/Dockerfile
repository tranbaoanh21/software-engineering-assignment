FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/iot-simulator/package.json apps/iot-simulator/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci -w @semh/web -w @semh/contracts --include-workspace-root --no-audit --no-fund
COPY packages/contracts/ packages/contracts/
COPY apps/web/ apps/web/
RUN npm run build -w @semh/contracts && npm run build -w @semh/web

FROM nginx:stable-alpine
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
