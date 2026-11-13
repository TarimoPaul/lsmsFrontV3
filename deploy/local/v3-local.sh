#!/usr/bin/env bash
# V3 Docker-local (owner 31/10 bg) - the normal way to test V3 from now on (no ng serve). From Git Bash:
#
#   deploy/local/v3-local.sh build   production build of THIS worktree (--base-href /v3/, like deploy/Dockerfile)
#   deploy/local/v3-local.sh up      serve dist/ with the prod nginx.conf behind an edge nginx: http://127.0.0.1:4300/v3/
#   deploy/local/v3-local.sh down
#
# /api goes to the backend Docker-local (backend repo: deploy/local/local.sh up <image>), which must be running.
set -u
H=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$H/../.." && pwd)
HW=$(cygpath -w "$H")
DC() { MSYS_NO_PATHCONV=1 docker compose -f "$HW/docker-compose.v3-local.yml" --project-directory "$HW" "$@"; }
die() { echo "SIYO: $*"; exit 1; }

case "${1:-}" in
  build)
    cd "$ROOT" || exit 1
    rm -rf dist/lsmsFrontV3
    # (gp 4) "npx ng build" skips the npm prebuild hook, so version.json was never stamped here (it stayed 3.0.0 of 06/10):
    # stamp it as the image build does (npm run build -> prebuild), from .frontend-v3-version
    node scripts/stamp-version.mjs || die "stamp-version"
    # ng-exit.cjs: a finished ng build does not exit by itself (see that file)
    MSYS_NO_PATHCONV=1 NODE_OPTIONS="--require ./deploy/ng-exit.cjs" npx ng build --configuration production --base-href /v3/ \
      || die "ng build"
    grep -q '<base href="/v3/">' dist/lsmsFrontV3/browser/index.html || die "base href si /v3/"
    WANT=$(tr -d '[:space:]' < .frontend-v3-version)
    grep -q "\"version\": *\"$WANT\"" dist/lsmsFrontV3/browser/version.json || die "version.json ya build si $WANT"
    echo "BUILD_SAWA $(git rev-parse --short HEAD)$([ -n "$(git status --porcelain -- src)" ] && echo ' (+ mabadiliko yasiyocommitiwa)')"
    ;;
  up)
    [ -f "$ROOT/dist/lsmsFrontV3/browser/index.html" ] || die "hakuna dist - endesha build kwanza"
    docker network inspect lsms-local_default >/dev/null 2>&1 || die "backend Docker-local haiko juu (lsms-local_default)"
    DC up -d --force-recreate >/dev/null || die "docker compose up"
    for i in $(seq 1 30); do
      [ "$(curl -s -o /dev/null -w '%{http_code}' "127.0.0.1:${V3_LOCAL_PORT:-4300}/v3/")" = 200 ] && break; sleep 1
    done
    curl -s -o /dev/null -w "V3 %{http_code} " "127.0.0.1:${V3_LOCAL_PORT:-4300}/v3/"
    curl -s -o /dev/null -w "API %{http_code}\n" "127.0.0.1:${V3_LOCAL_PORT:-4300}/api/auth/validate" -X POST -H 'Content-Type: application/json' -d '{"token":"x"}'
    echo "V3_LOCAL_TAYARI http://127.0.0.1:${V3_LOCAL_PORT:-4300}/v3/"
    ;;
  down)
    DC down
    ;;
  *)
    sed -n '2,8p' "$0"; exit 1
    ;;
esac
