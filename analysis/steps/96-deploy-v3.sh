#!/usr/bin/env bash
# HATUA 96 (mmiliki 13/11 hq/hr) - deploy ya V3 PEKEE: frontend-v3 3.3.0 -> 3.3.1 (KUPIMA kwenye orodha ya POS).
#   Backend 2.5.0 HAIGUSWI (container yake haiundwi upya; tag + id ya container zinakaguliwa kabla na baada).
#   3.3.1 inatumia API za 2.5.0 tu (GET /api/v1/kupima/products, POST .../open, POST .../finish) - hakuna field/endpoint mpya.
#
#   bash 96-deploy-v3.sh <prod|staging> hali       kusoma tu: matoleo yanayoendesha, .env, image za rollback
#   bash 96-deploy-v3.sh <prod|staging> deploy     K1 kagua (backend 2.5.0, frontend-v3 3.3.0, image 3.3.0 IPO kwa rollback,
#                                                  amri ya rollback inaandikwa KABLA ya kubadili) -> K2 pull 3.3.1 + version.json
#                                                  ya image = 3.3.1 -> K3 badili (.env FRONTEND_V3_VERSION tu + up frontend-v3)
#                                                  -> HEALTH: frontend-v3 3.3.1, /v3/version.json 3.3.1, backend bado 2.5.0
#                                                  na container ileile, /v3/ 200, login {} 400. Health ikishindwa -> ROLLBACK.
#   bash 96-deploy-v3.sh <prod|staging> rollback   frontend-v3 -> 3.3.0 (.env FRONTEND_V3_VERSION tu), backend haiguswi.
#
# Haifuti image yoyote. Haiandiki thamani ya siri. Majaribio (PC, server ya kuigiza): L96_HOME, L96_DIR, L96_PROJ,
# L96_BASE, L96_IMG_V3, L96_SLEEP.
set -uo pipefail

TARGET="${1:-}"; ACTION="${2:-}"
H="${L96_HOME:-$HOME}"
NEW_V3=3.3.1; OLD_V3=3.3.0; BE=2.5.0
IMG_V3=${L96_IMG_V3:-chiefmaster/lsms-frontend-v3}
SLEEP="${L96_SLEEP:-3}"
case "$TARGET" in
  prod)    DIR="${L96_DIR:-$H/lsms-deployment}"; PROJ="${L96_PROJ:-lsms-deployment}"; BASE="${L96_BASE:-http://localhost}" ;;
  staging) DIR="${L96_DIR:-$H/lsms-staging}";    PROJ="${L96_PROJ:-lsms-staging}";    BASE="${L96_BASE:-http://127.0.0.1:8081}" ;;
  *) echo "MATUMIZI: $0 <prod|staging> <hali|deploy|rollback>"; exit 2 ;;
esac
SITE_HOST=elikom.co.tz
ST="$H/lsms-331/$TARGET"; BK="$ST/backup"
mkdir -p "$ST" && chmod 700 "$H/lsms-331" "$ST" 2>/dev/null
say() { echo "[96 $TARGET $(date +%H:%M:%S)] $*"; }
die() { echo "[96 $TARGET $(date +%H:%M:%S)] SIYO: $*"; echo "---96_IMESHINDWA---"; exit 1; }
cd "$DIR" || die "$DIR haipo"
if [ "$ACTION" != hali ] && command -v flock >/dev/null; then
  exec 9>"$ST/lock"; flock -n 9 || { say "SIYO: 96 nyingine bado inaendesha"; echo "---96_INAENDESHA---"; exit 3; }
fi
DC()     { docker compose -p "$PROJ" "$@"; }
cid_of() { DC ps -q "$1" | head -n1; }
tag_of() { local c; c=$(cid_of "$1"); [ -n "$c" ] && docker inspect --format '{{.Config.Image}}' "$c" | sed 's/.*://'; }
envv()   { sed -n "s/^$1=//p" .env | tr -d '\r' | head -n1; }
code()   { curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $SITE_HOST" "$@" 2>/dev/null || true; }
vjson()  { curl -s --max-time 10 -H "Host: $SITE_HOST" "$BASE/v3/version.json" 2>/dev/null | sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p'; }
img_ver() { docker run --rm --network none --entrypoint cat "$1" /usr/share/nginx/html/v3/version.json 2>/dev/null | sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p'; }
set_v3() {  # .env: FRONTEND_V3_VERSION tu; mstari mwingine wowote ukibadilika -> .env inarudishwa
  local b; b=$(mktemp "$ST/env.XXXX"); cp -p .env "$b"
  local CR=$'\r'; sed -i "s/^FRONTEND_V3_VERSION=[^$CR]*/FRONTEND_V3_VERSION=$1/" .env   # CRLF ya .env inabaki
  if [ "$(grep -c '^FRONTEND_V3_VERSION=' .env)" != 1 ] || [ "$(envv FRONTEND_V3_VERSION)" != "$1" ] \
     || ! diff -q <(grep -v '^FRONTEND_V3_VERSION=' "$b") <(grep -v '^FRONTEND_V3_VERSION=' .env) >/dev/null; then
    cp -p "$b" .env; rm -f "$b"; say ".env: kubadilisha FRONTEND_V3_VERSION kumekataliwa - .env imerudishwa"; return 1
  fi
  rm -f "$b"
}
# health <v3> <backend container id kabla>: frontend-v3 = v3, version.json = v3, backend bado BE na container ileile, http
health() {
  local i v c1 c2 c3 b
  for i in $(seq 1 20); do
    v=$(vjson); c1=$(code "$BASE/v3/"); c2=$(code -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/api/auth/login")
    [ "$(tag_of frontend-v3)" = "$1" ] && [ "$v" = "$1" ] && [ "$c1" = 200 ] && [ "$c2" = 400 ] && break
    sleep "$SLEEP"
  done
  b=$(cid_of backend)
  say "HEALTH: frontend-v3 $(tag_of frontend-v3) | /v3/version.json ${v:-?} | /v3/ $c1 | POST /api/auth/login {} $c2 | backend $(tag_of backend) container ${b:0:12} (kabla ${2:0:12})"
  [ "$(tag_of frontend-v3)" = "$1" ] && [ "$v" = "$1" ] && [ "$c1" = 200 ] && [ "$c2" = 400 ] && [ "$(tag_of backend)" = "$BE" ] && [ "$b" = "$2" ] || return 1
  say "HEALTH SAWA: frontend-v3 $1, backend bado $BE (container haijaundwa upya)"
}
rollback() {
  say "=== ROLLBACK: frontend-v3 -> $OLD_V3 (backend haiguswi)"
  local b0; b0=$(cid_of backend)
  docker image inspect "$IMG_V3:$OLD_V3" >/dev/null 2>&1 || die "image $IMG_V3:$OLD_V3 HAIPO - rollback haiwezekani bila pull"
  set_v3 "$OLD_V3" || die ".env haikubadilika (rollback)"
  DC up -d --no-deps frontend-v3 || die "compose up frontend-v3 (rollback) imeshindwa"
  health "$OLD_V3" "$b0" || die "rollback: health ya $OLD_V3 imeshindwa - angalia mara moja"
  say "ROLLBACK_OK: frontend-v3 $OLD_V3"
}

case "$ACTION" in
  hali)
    say "backend $(tag_of backend) | frontend-v3 $(tag_of frontend-v3) | .env FRONTEND_V3_VERSION =$(envv FRONTEND_V3_VERSION) | /v3/version.json $(vjson)"
    for i in "$IMG_V3:$OLD_V3" "$IMG_V3:$NEW_V3"; do docker image inspect "$i" >/dev/null 2>&1 && say "image IPO $i" || say "image HAIPO $i"; done
    say ".frontend-v3.prev=$(cat .frontend-v3.prev 2>/dev/null)"
    echo "---96_MWISHO---" ;;
  rollback)
    rollback; echo "---96_MWISHO---" ;;
  deploy)
    T0=$(date +%s)
    say "=== K1 KAGUA"
    be=$(tag_of backend); v3=$(tag_of frontend-v3); B0=$(cid_of backend)
    say "inaendesha: backend $be (container ${B0:0:12}), frontend-v3 $v3, .env FRONTEND_V3_VERSION =$(envv FRONTEND_V3_VERSION)"
    [ "$be" = "$BE" ] || die "backend inatarajiwa $BE, ni '$be'"
    if [ "$v3" = "$NEW_V3" ]; then
      say "frontend-v3 tayari $NEW_V3 - nakagua health tu"
      health "$NEW_V3" "$B0" || die "health ya $NEW_V3 imeshindwa (rollback: 96-deploy-v3.cmd $TARGET rollback)"
      say "DEPLOY_V3_OK $NEW_V3 (ilishafanyika)"; echo "---96_MWISHO---"; exit 0
    fi
    [ "$v3" = "$OLD_V3" ] || die "frontend-v3 inatarajiwa $OLD_V3 kabla ya deploy, ni '$v3'"
    grep -q '^FRONTEND_V3_VERSION=' .env || die ".env haina FRONTEND_V3_VERSION"
    docker image inspect "$IMG_V3:$OLD_V3" >/dev/null 2>&1 || die "image $IMG_V3:$OLD_V3 HAIPO - hakuna rollback, simama"
    say "image ya rollback IPO: $IMG_V3:$OLD_V3 (version.json $(img_ver "$IMG_V3:$OLD_V3"))"
    mkdir -p "$BK"; cp -p .env "$BK/.env"; [ -f .frontend-v3.prev ] && cp -p .frontend-v3.prev "$BK/"
    say "backup: $BK/.env"
    say "AMRI YA ROLLBACK (kabla ya kubadili): 96-deploy-v3.cmd $TARGET rollback   -> frontend-v3 $OLD_V3, backend haiguswi"
    say "=== K2 PULL"
    if ! docker image inspect "$IMG_V3:$NEW_V3" >/dev/null 2>&1; then docker pull -q "$IMG_V3:$NEW_V3" >/dev/null || die "docker pull $IMG_V3:$NEW_V3 imeshindwa"; fi
    iv=$(img_ver "$IMG_V3:$NEW_V3")
    [ "$iv" = "$NEW_V3" ] || die "version.json ndani ya image $IMG_V3:$NEW_V3 ni '$iv', si $NEW_V3"
    say "image $IMG_V3:$NEW_V3 $(docker image inspect -f '{{.Id}}' "$IMG_V3:$NEW_V3" | cut -c8-19) | version.json $iv"
    say "=== K3 BADILI (frontend-v3 tu)"
    echo "$OLD_V3" > .frontend-v3.prev
    set_v3 "$NEW_V3" || die ".env haikubadilika salama - hakuna kilichobadilishwa"
    DC up -d --no-deps frontend-v3 || { rollback; die "compose up imeshindwa - ROLLBACK imefanyika"; }
    if ! health "$NEW_V3" "$B0"; then rollback; die "$NEW_V3 haikupita health - ROLLBACK imefanyika"; fi
    say "DEPLOY_V3_OK frontend-v3 $NEW_V3, backend $BE haikuguswa ($(( $(date +%s) - T0 ))s). Rollback: 96-deploy-v3.cmd $TARGET rollback"
    echo "---96_MWISHO---" ;;
  *) echo "MATUMIZI: $0 <prod|staging> <hali|deploy|rollback>"; exit 2 ;;
esac
