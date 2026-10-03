#!/usr/bin/env bash
# Server side of deploy-v3.ps1 (copied to the server and run there by that script).
#   bash remote-deploy-v3.sh <version>
# Switches the frontend-v3 service to chiefmaster/lsms-frontend-v3:<version>,
# health-checks it through the main nginx and rolls back automatically on failure.
# Touches ONLY the frontend-v3 service and the FRONTEND_V3_VERSION line of .env.
set -euo pipefail

NEW="${1:-}"
IMAGE="chiefmaster/lsms-frontend-v3"
SVC="frontend-v3"
VAR="FRONTEND_V3_VERSION"
SITE_HOST="elikom.co.tz"
# Overridable only for a local dry run of this script against a test compose
# project (with LSMS_SKIP_PULL=1 for images that exist only locally).
COMPOSE_DIR="${LSMS_COMPOSE_DIR:-$HOME/lsms-deployment}"
BASE="${LSMS_BASE_URL:-http://localhost}"
PREV_FILE=".frontend-v3.prev"

say()  { echo "[v3] $*"; }
die()  { echo "[v3] ERROR: $*" >&2; exit 1; }

[[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version must be semver (got '$NEW')"
cd "$COMPOSE_DIR"

grep -q "^${VAR}=" .env \
  || die "$VAR is not in .env - run the one-time server setup first (deploy/DEPLOY_V3.md)"
SERVICES="$(docker compose config --services < /dev/null)"
grep -qx "$SVC" <<<"$SERVICES" \
  || die "service $SVC is not in the compose files - run the one-time server setup first"

# ── what is running now (rollback target) ───────────────────────────────────
running_tag() {
  local cid
  cid="$(docker compose ps -q "$SVC" < /dev/null 2>/dev/null | head -n1)"
  [ -n "$cid" ] || return 0
  docker inspect --format '{{.Config.Image}}' "$cid" 2>/dev/null | sed -n "s|^${IMAGE}:||p"
}
PREV="$(running_tag)"
PREV_ENV="$(sed -n "s/^${VAR}=//p" .env | tr -d '\r' | head -n1)"
say "running now: ${PREV:-<none>}   new: $NEW"
[ -n "$PREV" ] && echo "$PREV" > "$PREV_FILE"

# The ONLY place .env is edited. Every edit: timestamped backup first, replace
# exactly the FRONTEND_V3_VERSION= line, prove nothing else changed and that
# compose still parses; otherwise put the backup back and report failure.
set_version() {
  local v="$1" bak why=""
  bak=".env.bak.v3.$(date +%Y%m%d-%H%M%S)-$$-$RANDOM"
  cp -p .env "$bak" || { say ".env backup failed - .env not touched"; return 1; }

  if   ! sed -i "s/^${VAR}=.*\$/${VAR}=${v}/" .env;                          then why="sed failed"
  elif [ "$(grep -c "^${VAR}=" .env)" != "1" ];                              then why="expected exactly one ${VAR}= line"
  elif ! grep -qx "${VAR}=${v}" .env;                                        then why="${VAR} line is not '${v}'"
  elif ! diff -q <(grep -v "^${VAR}=" "$bak") <(grep -v "^${VAR}=" .env) > /dev/null
                                                                             then why="another line of .env changed"
  elif ! docker compose config --quiet < /dev/null;                          then why="docker compose config --quiet failed"
  fi

  if [ -n "$why" ]; then
    cp -p "$bak" .env
    say ".env edit rejected ($why) - .env restored from $bak"
    return 1
  fi
  # Keep the 5 newest backups (they hold secrets: same 600 mode as .env).
  ls -1t .env.bak.v3.* 2>/dev/null | tail -n +6 | xargs -r rm -f --
  return 0
}

# ── health check through the main nginx (same path a browser takes) ─────────
get()  { curl -sS --max-time 10 -H "Host: $SITE_HOST" "$@"; }
code() { get -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true; }

check_once() {
  local want="$1" html js ctype ver deep
  [ "$(code "$BASE/v3/")" = "200" ]                         || { echo "/v3/ is not 200"; return 1; }
  html="$(get "$BASE/v3/")"                                 || { echo "/v3/ unreachable"; return 1; }
  grep -q '<base href="/v3/">' <<<"$html"                   || { echo '/v3/ has no <base href="/v3/">'; return 1; }
  js="$(grep -oE 'main-[A-Z0-9]+\.js' <<<"$html" | head -n1)"
  [ -n "$js" ]                                              || { echo "no main-*.js in index.html"; return 1; }
  [ "$(code "$BASE/v3/$js")" = "200" ]                      || { echo "/v3/$js is not 200"; return 1; }
  ctype="$(get -o /dev/null -w '%{content_type}' "$BASE/v3/$js")"
  grep -qi 'javascript' <<<"$ctype"                         || { echo "/v3/$js is not javascript ($ctype)"; return 1; }
  ver="$(get "$BASE/v3/version.json")"                      || { echo "version.json unreachable"; return 1; }
  grep -q "\"version\": *\"$want\"" <<<"$ver"               || { echo "version.json is not $want"; return 1; }
  deep="$(get "$BASE/v3/sales")"                            || { echo "/v3/sales unreachable"; return 1; }
  grep -q '<base href="/v3/">' <<<"$deep"                   || { echo "deep link /v3/sales does not return the app"; return 1; }
  return 0
}

# nginx re-resolves the recreated container within ~10s (resolver valid=10s).
health_check() {
  local want="$1" i why=""
  for i in $(seq 1 20); do
    if why="$(check_once "$want" 2>&1)"; then return 0; fi
    sleep 3
  done
  say "health check failed: $why"
  return 1
}

# GET / : 200, or a 302 to /v3/ (prod sends the site root to V3). The Location may be the
# relative "/v3/" or the same host made absolute by nginx (absolute_redirect).
root_ok() {
  local hdr c loc
  hdr="$(curl -s -o /dev/null -D - --max-time 10 -H "Host: $SITE_HOST" "$BASE/" 2>/dev/null || true)"
  c="$(awk 'NR==1 {print $2}' <<<"$hdr" || true)"
  loc="$(grep -i '^location:' <<<"$hdr" | head -n1 | cut -d' ' -f2- | tr -d '\r' || true)"
  case "$c" in
    200) return 0 ;;
    302) case "$loc" in "/v3/"|"http://$SITE_HOST/v3/"|"https://$SITE_HOST/v3/") return 0 ;; esac
         say "GET / returned 302 to '$loc' (want /v3/)"; return 1 ;;
    *)   say "GET / returned '$c' (want 200, or 302 to /v3/)"; return 1 ;;
  esac
}

# Flutter is checked on /index.html (served whatever / redirects to): 200 and not the V3 app.
flutter_ok() {
  local html
  root_ok || return 1
  [ "$(code "$BASE/index.html")" = "200" ] || { say "GET /index.html (Flutter) is not 200"; return 1; }
  html="$(get "$BASE/index.html")" || return 1
  ! grep -q '<base href="/v3/">' <<<"$html" || { say "/index.html serves the V3 app, not Flutter"; return 1; }
}

rollback() {
  say "ROLLING BACK"
  docker compose logs --tail 20 "$SVC" < /dev/null 2>&1 | sed 's/^/[v3]   /' || true
  if [ -n "$PREV" ]; then
    if set_version "$PREV" && docker compose up -d --no-deps "$SVC" < /dev/null && health_check "$PREV"; then
      say "ROLLED_BACK to $PREV (healthy)"
    else
      say "ROLLBACK to $PREV did NOT pass the health check - check the server now"
    fi
  else
    # First deploy: nothing to go back to. Flutter and /api are not affected.
    if [ -n "$PREV_ENV" ]; then set_version "$PREV_ENV" || true; fi
    say "no previous v3 version to roll back to; failed container left in place for inspection"
  fi
}

# ── deploy ──────────────────────────────────────────────────────────────────
# 1. Pull first: the old container keeps serving and nothing has changed yet.
if [ -z "${LSMS_SKIP_PULL:-}" ]; then
  say "pulling $IMAGE:$NEW"
  docker pull "$IMAGE:$NEW" < /dev/null || die "pull failed - nothing was changed"
fi

# 2. Switch the tag and recreate only this service.
set_version "$NEW" || die ".env could not be updated safely - it was restored, nothing was changed"
if ! docker compose up -d --no-deps "$SVC" < /dev/null; then
  rollback
  die "compose up failed"
fi

# 3. Verify; roll back on failure.
if ! health_check "$NEW"; then
  rollback
  die "new version $NEW failed the health check"
fi
if ! flutter_ok; then
  rollback
  die "Flutter (/index.html) or the site root (/ -> 200 or 302 /v3/) is not answering as expected"
fi

# 4. Keep the new + previous image only (this repository only - no global prune).
docker images "$IMAGE" --format '{{.Tag}}' | while IFS= read -r tag; do
  [ "$tag" = "$NEW" ] || [ "$tag" = "$PREV" ] || [ "$tag" = "<none>" ] && continue
  docker rmi "$IMAGE:$tag" < /dev/null > /dev/null 2>&1 || true
done

docker compose ps "$SVC" --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}' < /dev/null
echo "DEPLOY_OK $NEW"
