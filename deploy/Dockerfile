# LSMS Angular V3 frontend image. Build context = repo root:
#   docker build -f deploy/Dockerfile --build-arg APP_VERSION=3.0.0 -t chiefmaster/lsms-frontend-v3:3.0.0 .
# Served under /v3/ (Flutter keeps /), so the build uses --base-href /v3/ and the
# files live in /usr/share/nginx/html/v3/.

# ── build ── node major pinned to the dev PC (node -v = v22.13.1)
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Stamped into version.json by the prebuild hook (scripts/stamp-version.mjs).
ARG APP_VERSION=0.0.0
ENV LSMS_APP_VERSION=$APP_VERSION

# ng-exit.cjs: a finished `ng build` does not exit by itself (see that file).
RUN NODE_OPTIONS="--require /app/deploy/ng-exit.cjs" \
    npm run build -- --configuration production --base-href /v3/ \
 && grep -q '<base href="/v3/">' dist/lsmsFrontV3/browser/index.html \
 && ls dist/lsmsFrontV3/browser/main-*.js > /dev/null

# ── runtime ──
FROM nginx:1.31.2-alpine

RUN rm -rf /usr/share/nginx/html/*
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/lsmsFrontV3/browser/ /usr/share/nginx/html/v3/

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/v3/index.html || exit 1
