# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

RUN apk add --no-cache nodejs git bash curl jq

WORKDIR /app

ENV DATA_DIR=/project-data \
    KUNPENG_REPO_URL=https://gitcode.com/openeuler/openeuler-docker-images.git \
    KUNPENG_BRANCH=master \
    KUNPENG_TESTS_PATH=tests \
    ASCEND_REPO_URL=https://github.com/MrZ20/ascend-testdata.git \
    ASCEND_BRANCH=main \
    ASCEND_PROJECTS_PATH=project \
    ASCEND_CI_RUN_SCRIPTS=1 \
    PROJECT_SOURCE_DIR=/project-data/_source-cache \
    SYNC_INTERVAL_SECONDS=86400 \
    SYNC_LOCK_STALE_SECONDS=7200 \
    SYNC_SERVER_PORT=3001 \
    SYNC_SCRIPT_PATH=/app/scripts/sync-data.mjs

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY scripts /app/scripts
COPY docker/entrypoint.sh /app/entrypoint.sh
COPY --from=builder /app/dist /usr/share/nginx/html

RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /project-data /project-data/_source-cache

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
