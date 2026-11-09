#!/usr/bin/env bash
# HATUA 76 (mmiliki 09/11 cz/da/de/df): deploy ya backend 2.4.0 + frontend-v3 3.2.0 - SCRIPT MOJA kwa staging na prod.
#
#   bash 76-deploy-240.sh <staging|prod> hali        kusoma tu: matoleo, Flyway, image, hatua zilizokamilika
#   bash 76-deploy-240.sh <staging|prod> deploy      K1 kagua -> K2 backup -> K3 pull -> K4 env/compose -> K5 badili -> K6 smoke
#                                                    INAENDELEA baada ya kukatika: kila hatua iliyokamilika imeandikwa kwenye
#                                                    ~/lsms-240/<target>/hali na inarukwa; kila hatua ni idempotent.
#   bash 76-deploy-240.sh <staging|prod> rollback    backend 2.3.0 + frontend-v3 3.1.11, .env + compose za backup (kabla ya K4).
#                                                    DB HAIRUDISHWI (V136-V138 ni za kuongeza tu; 2.3.0 inazipuuza).
#   bash 76-deploy-240.sh staging refresh-db [dump]  STAGING TU: DB <- dump ya prod (default: ~/backups/daily ya leo)
#
# Haifuti image yoyote (de: siku ya deploy hakuna kufuta). Haiandiki thamani ya siri kwenye output.
# Majaribio (PC): L76_HOME, L76_DIR, L76_BASE, L76_SLEEP=0 - kwa server ya kuigiza tu.
set -uo pipefail

TARGET="${1:-}"; ACTION="${2:-}"; ARG3="${3:-}"
H="${L76_HOME:-$HOME}"
NEW_BE=2.4.0; NEW_V3=3.2.0; OLD_BE=2.3.0; OLD_V3=3.1.11
IMG_BE=chiefmaster/my-lsms-backend; IMG_V3=chiefmaster/lsms-frontend-v3
ROLES='CEO,Executive CEO'
ENV_ONDOA='ADMIN_EMAIL ADMIN_PASSWORD DOCKERHUB_USERNAME DOCKERHUB_PASSWORD'
FLY_OLD=135; FLY_NEW=138
START_MARK='Started LsmsApplication'
SLEEP="${L76_SLEEP:-3}"

case "$TARGET" in
  prod)    DIR="${L76_DIR:-$H/lsms-deployment}"; PROJ=lsms-deployment; BASE="${L76_BASE:-http://localhost}"; B2=1 ;;
  staging) DIR="${L76_DIR:-$H/lsms-staging}";    PROJ=lsms-staging;    BASE="${L76_BASE:-http://127.0.0.1:8081}"; B2=0 ;;
  *) echo "MATUMIZI: $0 <staging|prod> <hali|deploy|rollback|refresh-db>"; exit 2 ;;
esac
SITE_HOST=elikom.co.tz
ST="$H/lsms-240/$TARGET"; HALI="$ST/hali"; BK="$ST/backup"
mkdir -p "$ST" && chmod 700 "$H/lsms-240" "$ST" 2>/dev/null
T0=$(date +%s)
# 76 moja tu kwa wakati mmoja (kwa kila target): driver ya PC ikiunganisha tena, haianzishi ya pili
if [ "$ACTION" != hali ] && command -v flock >/dev/null; then
  exec 9>"$ST/lock"; flock -n 9 || { echo "[76 $TARGET] SIYO: 76 nyingine bado inaendesha ($ST/lock)"; echo "---76_INAENDESHA---"; exit 3; }
fi

say()  { echo "[76 $TARGET $(date +%H:%M:%S)] $*"; }
die()  { echo "[76 $TARGET $(date +%H:%M:%S)] SIYO: $*"; echo "---76_IMESHINDWA---"; exit 1; }
# (di) BILA "< /dev/null" hapa: ingefuta "< dump" ya anayeita (pg_restore ilisoma bytes 0). stdin ya script
# tayari ni /dev/null (nohup ya driver / ssh -n).
DC()   { docker compose -p "$PROJ" "$@"; }
done_k() { grep -q "^DONE $1 " "$HALI" 2>/dev/null; }
mark()   { echo "DONE $1 $(date +%Y-%m-%dT%H:%M:%S) $(( $(date +%s) - KT ))s" >> "$HALI"; say "$1 IMEKAMILIKA ($(( $(date +%s) - KT ))s)"; }
unmark() { [ -f "$HALI" ] && sed -i "/^DONE $1 /d" "$HALI"; }
anza()   { KT=$(date +%s); say "=== $1"; }
psql_q() { DC exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -c "$SQL"'; }
tag_of() { local c; c=$(DC ps -q "$1" | head -n1); [ -n "$c" ] && docker inspect --format '{{.Config.Image}}' "$c" | sed 's/.*://'; }
envv()   { sed -n "s/^$1=//p" "$DIR/.env" | tr -d '\r' | head -n1; }
code()   { curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Host: $SITE_HOST" "$@" 2>/dev/null || true; }
# (di) dump nzima? 1) --list: TOC + idadi ya entries  2) pg_restore -f /dev/null: inasoma FAILI LOTE
#      (--list peke yake inapita hata dump iliyokatwa, kwa sababu TOC iko mwanzoni)
dump_ok() {
  local n
  n=$(DC exec -T postgres pg_restore --list < "$1" | grep -vc '^;') || { say "pg_restore --list imeshindwa: $1"; return 1; }
  [ "$n" -gt 100 ] || { say "pg_restore --list: entries $n tu"; return 1; }
  DC exec -T postgres pg_restore -f /dev/null < "$1" || { say "pg_restore haikusoma faili lote (limekatika?): $1"; return 1; }
  DUMP_INFO="pg_restore --list entries $n, kusoma faili lote SAWA"
}
fly_max(){ psql_q "select max(version::int) from flyway_schema_history where success and version ~ '^[0-9]+\$'"; }

cd "$DIR" 2>/dev/null || die "folda $DIR haipo"
[ -f .env ] || die ".env haipo kwenye $DIR"
COMPOSE_FILES=$(ls -1 docker-compose*.yml 2>/dev/null)

# ── health: container ya <svc> ni <image:tag>, imeanza, na http inajibu ──────────────────────────────────────
wait_started() {  # backend: START_MARK ndani ya 240s bila kuanguka
  local cid w=0 st lg
  cid=$(DC ps -q backend | head -n1); [ -n "$cid" ] || { say "hakuna container ya backend"; return 1; }
  while [ $w -lt 240 ]; do
    # (pipefail) grep -q ingefunga pipe mapema -> SIGPIPE; soma log kwenye kigeu kwanza
    lg=$(docker logs ${UP_TS:+--since "$UP_TS"} "$cid" 2>&1); grep -q "$START_MARK" <<<"$lg" && { say "backend: '$START_MARK' baada ya ~${w}s"; return 0; }
    st=$(docker inspect --format '{{.State.Status}} {{.RestartCount}}' "$cid" 2>/dev/null || echo 'gone 0')
    [ "$st" = "running 0" ] || { say "backend container ni '$st' - imeanguka"; return 1; }
    sleep "$SLEEP"; w=$((w+3))
  done
  say "backend haikuandika '$START_MARK' ndani ya 240s"; return 1
}
http_ok() {
  local i c1 c2 c3
  for i in $(seq 1 30); do
    c1=$(code -H 'Content-Type: application/json' -X POST -d '{}' "$BASE/api/auth/login")
    c2=$(code "$BASE/v3/")
    c3=$(code "$BASE/api/v1/sales")
    if [ "$c1" = 400 ] && [ "$c2" = 200 ] && { [ "$c3" = 401 ] || [ "$c3" = 403 ]; }; then
      say "http SAWA: POST /api/auth/login {}=400, /v3/=200, /api/v1/sales (bila tokeni) $c3"; return 0; fi
    sleep "$SLEEP"
  done
  say "http SIYO: login=$c1 (400), /v3/=$c2 (200), /api/v1/sales=$c3 (401/403)"; return 1
}
health() {  # health <be> <v3>
  local be v3
  be=$(tag_of backend); v3=$(tag_of frontend-v3)
  [ "$be" = "$1" ] || { say "backend inaendesha '$be', siyo $1"; return 1; }
  [ "$v3" = "$2" ] || { say "frontend-v3 inaendesha '$v3', siyo $2"; return 1; }
  wait_started || return 1
  http_ok || return 1
  local cid bad
  cid=$(DC ps -q backend | head -n1)
  bad=$(docker logs ${UP_TS:+--since "$UP_TS"} "$cid" 2>&1 | sed "/$START_MARK/q" | grep -E ' (ERROR|FATAL) |FlywayException|Migration .* failed|APPLICATION FAILED TO START' | head -5)
  [ -z "$bad" ] || { say "ERROR kwenye log ya kuanza:"; echo "$bad" | cut -c1-250; return 1; }
  say "HEALTH SAWA: backend $1, frontend-v3 $2"
}

# ── .env: badilisha mstari mmoja tu na thibitisha kingine hakijabadilika ─────────────────────────────────────
set_line() {  # set_line VAR value
  local v="$1" val="$2" b
  b=$(mktemp "$ST/env.XXXX"); cp -p .env "$b"
  sed -i "s/^${v}=.*\$/${v}=${val}/" .env
  if [ "$(grep -c "^${v}=" .env)" != 1 ] || ! grep -qx "${v}=${val}" .env \
     || ! diff -q <(grep -v "^${v}=" "$b") <(grep -v "^${v}=" .env) >/dev/null; then
    cp -p "$b" .env; rm -f "$b"; say ".env: kubadilisha $v kumekataliwa - .env imerudishwa"; return 1
  fi
  rm -f "$b"
}

hali() {
  say "backend $(tag_of backend) | frontend-v3 $(tag_of frontend-v3) | .env BACKEND_VERSION=$(envv BACKEND_VERSION) FRONTEND_V3_VERSION=$(envv FRONTEND_V3_VERSION)"
  say "Flyway ya mwisho: $(fly_max)"
  for k in $ENV_ONDOA DAILY_SALES_PROFIT_ROLES; do grep -q "^$k=" .env && say ".env ina $k" || say ".env HAINA $k"; done
  for i in "$IMG_BE:$OLD_BE" "$IMG_V3:$OLD_V3" "$IMG_BE:$NEW_BE" "$IMG_V3:$NEW_V3"; do
    docker image inspect "$i" >/dev/null 2>&1 && say "image IPO $i" || say "image HAIPO $i"; done
  say ".backend.prev=$(cat .backend.prev 2>/dev/null) .frontend-v3.prev=$(cat .frontend-v3.prev 2>/dev/null)"
  [ -f "$HALI" ] && sed 's/^/[hali] /' "$HALI" || say "hakuna hatua iliyokamilika bado"
}

# ═════════════════════════════════════════ K1 KAGUA (kusoma tu) ═════════════════════════════════════════════
k1() {
  anza K1-KAGUA
  local be v3 fm
  be=$(tag_of backend); v3=$(tag_of frontend-v3); fm=$(fly_max)
  say "inaendesha: backend $be, frontend-v3 $v3, Flyway $fm"
  # ROLLBACK KWANZA (da): image za zamani lazima ziwe kwenye server kabla ya kugusa chochote
  docker image inspect "$IMG_BE:$OLD_BE" >/dev/null 2>&1 || die "image ya rollback $IMG_BE:$OLD_BE HAIPO kwenye server"
  docker image inspect "$IMG_V3:$OLD_V3" >/dev/null 2>&1 || die "image ya rollback $IMG_V3:$OLD_V3 HAIPO kwenye server"
  say "image za rollback zipo: $OLD_BE + $OLD_V3"
  if ! done_k K5-BADILI; then
    [ "$be" = "$OLD_BE" ] || die "backend inatarajiwa $OLD_BE kabla ya deploy, ni '$be'"
    [ "$v3" = "$OLD_V3" ] || die "frontend-v3 inatarajiwa $OLD_V3 kabla ya deploy, ni '$v3'"
    # baada ya rollback (K2 ipo) schema tayari ina V136-V138
    if done_k K2-BACKUP; then
      [ "$fm" = "$FLY_OLD" ] || [ "$fm" = "$FLY_NEW" ] || die "Flyway inatarajiwa $FLY_OLD au $FLY_NEW (baada ya rollback), ni '$fm'"
    else
      [ "$fm" = "$FLY_OLD" ] || die "Flyway inatarajiwa $FLY_OLD kabla ya deploy, ni '$fm'"
    fi
  fi
  local free; free=$(df -Pk "$DIR" | awk 'NR==2{print int($4/1024/1024)}')
  [ "$free" -ge 5 ] || die "diski: ${free}G tu wazi"
  say "diski wazi ${free}G"
  grep -q '^BACKEND_VERSION=' .env && grep -q '^FRONTEND_V3_VERSION=' .env || die ".env haina BACKEND_VERSION/FRONTEND_V3_VERSION"
  mark K1-KAGUA
}

# ═════════════════════════════════════════ K2 BACKUP ═══════════════════════════════════════════════════════
# Haifanywi tena baada ya kukamilika (resume baada ya K5 isingechukua backup ya schema mpya kama "kabla").
k2() {
  done_k K2-BACKUP && { say "K2-BACKUP ilishakamilika - inarukwa (backup ya awali: $BK)"; return 0; }
  anza K2-BACKUP
  rm -rf "$BK"; mkdir -p "$BK" && chmod 700 "$BK"
  cp -p .env $COMPOSE_FILES "$BK/" || die "nakala ya .env/compose imeshindwa"
  for f in .backend.prev .frontend-v3.prev; do [ -f "$f" ] && cp -p "$f" "$BK/"; done
  DC config > "$BK/config-kabla.yml" 2>/dev/null || die "docker compose config (kabla) imeshindwa"
  chmod 600 "$BK"/* "$BK"/.[!.]* 2>/dev/null
  local D="$BK/lsms_kabla_240_$(date +%Y%m%d_%H%M%S).dump"
  DC exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$D" || die "pg_dump imeshindwa"
  local sz; sz=$(stat -c %s "$D")
  [ "$sz" -gt $((5*1024*1024)) ] || die "dump ni bytes $sz tu (> 5MB inatarajiwa)"
  dump_ok "$D" || die "dump ya K2 si nzima"
  (cd "$BK" && sha256sum "$(basename "$D")" > "$(basename "$D").sha256") || die "sha256 imeshindwa"
  say "DUMP $(basename "$D") bytes $sz sha256 $(cut -c1-16 "$D.sha256")... $DUMP_INFO"
  if [ "$B2" = 1 ]; then
    rclone copy "$D" b2:elikom-lsms-backups/deploy/ && rclone copy "$D.sha256" b2:elikom-lsms-backups/deploy/ || die "rclone kwenda B2 imeshindwa"
    local rs; rs=$(rclone lsl "b2:elikom-lsms-backups/deploy/$(basename "$D")" | awk '{print $1}')
    [ "$rs" = "$sz" ] || die "B2: ukubwa $rs != $sz"
    say "B2 SAWA: deploy/$(basename "$D") ($rs bytes)"
  else
    say "B2: staging - dump inabaki kwenye server tu (prod ndiyo inapakiwa B2)"
  fi
  mark K2-BACKUP
}

# ═════════════════════════════════════════ K3 PULL ═════════════════════════════════════════════════════════
k3() {
  done_k K3-PULL && { say "K3-PULL ilishakamilika - inarukwa"; return 0; }
  anza K3-PULL
  docker pull -q "$IMG_BE:$NEW_BE" || die "pull $IMG_BE:$NEW_BE imeshindwa (docker login ya server? hatua 76-login)"
  docker pull -q "$IMG_V3:$NEW_V3" || die "pull $IMG_V3:$NEW_V3 imeshindwa"
  say "digest: $(docker image inspect --format '{{index .RepoDigests 0}}' "$IMG_BE:$NEW_BE" | sed 's/.*@//' | cut -c1-19) / $(docker image inspect --format '{{index .RepoDigests 0}}' "$IMG_V3:$NEW_V3" | sed 's/.*@//' | cut -c1-19)"
  mark K3-PULL
}

# ═════════════════════════════════════════ K4 ENV + COMPOSE ════════════════════════════════════════════════
# .env: ondoa ADMIN_EMAIL/ADMIN_PASSWORD/DOCKERHUB_USERNAME/DOCKERHUB_PASSWORD; ongeza DAILY_SALES_PROFIT_ROLES.
# compose: ondoa mistari ya ADMIN_EMAIL/ADMIN_PASSWORD (kila faili); ${ROOT_PASSWORD} -> ${ROOT_PASSWORD:-};
#          ongeza DAILY_SALES_PROFIT_ROLES kwenye environment ya backend (mtindo uleule wa mstari wa JWT_SECRET).
# Uthibitisho: `docker compose config` kabla/baada - tofauti ZINAZORUHUSIWA tu: ADMIN_* zimeondoka, ROLES imeongezeka.
k4() {
  done_k K4-ENV && { say "K4-ENV ilishakamilika - inarukwa"; return 0; }
  anza K4-ENV
  [ -f "$BK/.env" ] || die "backup ya .env haipo (K2)"
  local f n
  # kurudia K4 baada ya kukatika katikati: anza tena kutoka nakala za K2
  cp -p "$BK/.env" .env; for f in $COMPOSE_FILES; do cp -p "$BK/$f" "$f"; done
  for f in $COMPOSE_FILES; do
    sed -i -E '/(ADMIN_EMAIL|ADMIN_PASSWORD)/d; s/\$\{ROOT_PASSWORD\}/${ROOT_PASSWORD:-}/g' "$f"
  done
  n=$(grep -c 'JWT_SECRET' docker-compose.yml)
  [ "$n" = 1 ] || { k4_rudisha; die "docker-compose.yml ina mistari $n ya JWT_SECRET (1 inatarajiwa) - siwezi kuweka ROLES kwa uhakika"; }
  grep -q DAILY_SALES_PROFIT_ROLES docker-compose.yml || \
    sed -i -E '/JWT_SECRET/{p;s/JWT_SECRET/DAILY_SALES_PROFIT_ROLES/g}' docker-compose.yml
  local k; for k in $ENV_ONDOA; do sed -i "/^${k}=/d" .env; done
  grep -q '^DAILY_SALES_PROFIT_ROLES=' .env || echo "DAILY_SALES_PROFIT_ROLES=$ROLES" >> .env
  # .env: tofauti ni hizo tu
  local dl da
  dl=$(diff <(sed 's/\r$//' "$BK/.env") <(sed 's/\r$//' .env) | grep '^<' | sed -E 's/^< ([A-Za-z0-9_]+)=.*/\1/' | sort | tr '\n' ' ')
  da=$(diff <(sed 's/\r$//' "$BK/.env") <(sed 's/\r$//' .env) | grep '^>' | sed 's/^> //')
  local want_dl; want_dl=$(for k in $ENV_ONDOA; do grep -q "^$k=" "$BK/.env" && echo "$k"; done | sort | tr '\n' ' ')
  [ "$dl" = "$want_dl" ] || { k4_rudisha; die ".env: zilizoondoka '$dl' != '$want_dl'"; }
  [ "$da" = "DAILY_SALES_PROFIT_ROLES=$ROLES" ] || { k4_rudisha; die ".env: iliyoongezwa si ROLES pekee"; }
  # compose config: tofauti ni hizo tu
  DC config > "$ST/config-baada.yml" 2>/dev/null || { k4_rudisha; die "docker compose config (baada) imeshindwa"; }
  chmod 600 "$ST/config-baada.yml"
  local d bad
  d=$(diff "$BK/config-kabla.yml" "$ST/config-baada.yml" | grep -E '^[<>]')
  bad=$(echo "$d" | grep -v -E '^< .*(ADMIN_EMAIL|ADMIN_PASSWORD)|^> +(- )?DAILY_SALES_PROFIT_ROLES(: |=)(")?CEO,Executive CEO(")?$' | grep -v '^$')
  [ -z "$bad" ] || { k4_rudisha; say "tofauti zisizotarajiwa (majina tu):"; echo "$bad" | sed -E 's/^([<>] +[A-Za-z0-9_]+).*/\1/' | head; die "compose config ina tofauti zisizoruhusiwa - .env na compose zimerudishwa"; }
  grep -q '^> .*DAILY_SALES_PROFIT_ROLES' <<<"$d" || { k4_rudisha; die "ROLES haikufika kwenye config ya backend"; }
  say "compose config: ADMIN_* $(echo "$d" | grep -c '^<') imeondoka, DAILY_SALES_PROFIT_ROLES='$ROLES' imeongezeka - hakuna kingine"
  say ".env: $(echo $want_dl) zimeondolewa"
  rm -f "$ST/config-baada.yml"
  mark K4-ENV
}
k4_rudisha() { cp -p "$BK/.env" .env; local f; for f in $COMPOSE_FILES; do cp -p "$BK/$f" "$f"; done; }

# ═════════════════════════════════════════ K5 BADILI (2.4.0 + 3.2.0 pamoja) ═════════════════════════════════
k5() {
  if done_k K5-BADILI; then say "K5-BADILI ilishakamilika - nakagua health tu"; health "$NEW_BE" "$NEW_V3" || { rollback_core; die "health baada ya resume imeshindwa - ROLLBACK imefanyika"; }; return 0; fi
  anza K5-BADILI
  echo "$OLD_BE" > .backend.prev; echo "$OLD_V3" > .frontend-v3.prev
  set_line BACKEND_VERSION "$NEW_BE" && set_line FRONTEND_V3_VERSION "$NEW_V3" || { rollback_core; die ".env haikubadilika salama - ROLLBACK"; }
  UP_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)   # log za container hii tu tangu sasa (si "Started" ya zamani)
  DC up -d --no-deps backend frontend-v3 || { rollback_core; die "compose up imeshindwa - ROLLBACK"; }
  if ! health "$NEW_BE" "$NEW_V3"; then rollback_core; die "$NEW_BE/$NEW_V3 hazikupita health - ROLLBACK imefanyika"; fi
  local fm; fm=$(fly_max)
  local ok; ok=$(psql_q "select string_agg(version||':'||success, ' ' order by installed_rank) from flyway_schema_history where version in ('136','137','138')")
  say "Flyway: $ok (max $fm)"
  [ "$fm" = "$FLY_NEW" ] && [ "$ok" = "136:true 137:true 138:true" ] || { rollback_core; die "Flyway si 136-138 zote true - ROLLBACK"; }
  mark K5-BADILI
}

# ═════════════════════════════════════════ K6 SMOKE (seva) ═════════════════════════════════════════════════
k6() {
  anza K6-SMOKE
  health "$NEW_BE" "$NEW_V3" || die "smoke: health SIYO (rollback: bash $0 $TARGET rollback)"
  local cid e; cid=$(DC ps -q backend | head -n1)
  local cenv; cenv=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$cid")
  grep -qx "DAILY_SALES_PROFIT_ROLES=$ROLES" <<<"$cenv" \
    && say "container ya backend: DAILY_SALES_PROFIT_ROLES='$ROLES'" || die "container haina DAILY_SALES_PROFIT_ROLES sahihi"
  e=$(sed 's/=.*//' <<<"$cenv" | grep -E '^(ADMIN_EMAIL|ADMIN_PASSWORD|DOCKERHUB)' | tr '\n' ' ')
  [ -z "$e" ] && say "container haina ADMIN_*/DOCKERHUB_*" || die "container bado ina: $e"
  for t in sale_change_audit sale_change_ack login_audit login_audit_ack retention_run_log; do
    [ "$(psql_q "select to_regclass('public.$t') is not null")" = t ] || die "jedwali $t halipo"; done
  [ "$(psql_q "select count(*) from gl_account where account_code='2300'")" = 1 ] || die "akaunti 2300 haipo"
  say "jedwali 5 mapya + akaunti 2300 SAWA"
  local later; later=$(docker logs "$cid" 2>&1 | sed "1,/$START_MARK/d" | grep -cE ' (ERROR|FATAL) ')
  say "ERROR baada ya kuanza (maombi ya moja kwa moja): $later"
  mark K6-SMOKE
}

# ═════════════════════════════════════════ ROLLBACK ════════════════════════════════════════════════════════
rollback_core() {
  KT=$(date +%s); say "=== ROLLBACK kwenda $OLD_BE + $OLD_V3"
  local cid; cid=$(DC ps -q backend | head -n1)
  [ -n "$cid" ] && docker logs --tail 30 "$cid" 2>&1 | grep -E ' (ERROR|WARN) |Exception' | cut -c1-250 | head -10 | sed 's/^/[log] /'
  if [ -f "$BK/.env" ]; then
    cp -p "$BK/.env" .env; local f; for f in $COMPOSE_FILES; do [ -f "$BK/$f" ] && cp -p "$BK/$f" "$f"; done
    say ".env + compose zimerudishwa kutoka $BK"
  fi
  set_line BACKEND_VERSION "$OLD_BE"; set_line FRONTEND_V3_VERSION "$OLD_V3"
  UP_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  DC up -d --no-deps backend frontend-v3
  local rc=0
  health "$OLD_BE" "$OLD_V3" || rc=1
  say "Flyway ya mwisho: $(fly_max) (DB HAIJARUDISHWA - safu za V136-V138 ni za kuongeza/nullable/default; 2.3.0 inazipuuza)"
  unmark K4-ENV; unmark K5-BADILI; unmark K6-SMOKE; unmark K3-PULL
  echo "ROLLBACK $(date +%Y-%m-%dT%H:%M:%S) $(( $(date +%s) - KT ))s rc=$rc" >> "$HALI"
  [ $rc = 0 ] && say "ROLLBACK SAWA ($(( $(date +%s) - KT ))s): $OLD_BE + $OLD_V3 zinafanya kazi" || say "ROLLBACK HAIKUPITA HEALTH - kagua server SASA"
  return $rc
}

# ═════════════════════════════════════════ REFRESH-DB (staging tu) ═════════════════════════════════════════
refresh_db() {
  [ "$TARGET" = staging ] || die "refresh-db ni ya STAGING TU"
  [ "$(basename "$DIR")" = lsms-staging ] || die "folda si lsms-staging"
  local J="${ARG3:-$(ls -1t "$H/backups/daily"/lsms_$(TZ=Africa/Dar_es_Salaam date +%Y%m%d)_*.dump 2>/dev/null | head -n1)}"
  [ -n "$J" ] && [ -s "$J" ] || die "dump ya leo haipo kwenye $H/backups/daily (au toa njia kama hoja ya 3)"
  KT=$(date +%s); say "=== REFRESH-DB staging <- $(basename "$J") ($(stat -c %s "$J") bytes)"
  [ "$(tag_of backend)" = "$OLD_BE" ] || die "staging lazima iwe $OLD_BE kabla ya refresh (ni $(tag_of backend)) - endesha rollback kwanza"
  dump_ok "$J" || die "dump $J si nzima - DB ya staging HAIJAGUSWA"
  say "dump: $DUMP_INFO"
  DC stop backend || die "stop backend"
  DC exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"' || die "drop/create DB"
  DC exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < "$J" || die "pg_restore imeshindwa"
  [ "$(fly_max)" = "$FLY_OLD" ] || die "Flyway ya dump si $FLY_OLD"
  say "restore SAWA: Flyway $FLY_OLD, sales $(psql_q 'select count(*) from sales'), users $(psql_q 'select count(*) from users')"
  UP_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  DC up -d --no-deps backend || die "up backend"
  health "$OLD_BE" "$OLD_V3" || die "staging haikuwaka baada ya refresh"
  rm -f "$HALI"; rm -rf "$BK"
  say "REFRESH-DB SAWA ($(( $(date +%s) - KT ))s); hali ya 76 ya staging imefutwa (deploy itaanza K1)"
}

case "$ACTION" in
  hali)       hali ;;
  deploy)     k1; k2; k3; k4; k5; k6; hali; say "DEPLOY_OK $NEW_BE + $NEW_V3 (jumla $(( $(date +%s) - T0 ))s)" ;;
  rollback)   rollback_core || { echo "---76_IMESHINDWA---"; exit 1; }; hali ;;
  refresh-db) refresh_db ;;
  *) die "kitendo '$ACTION' hakijulikani (hali|deploy|rollback|refresh-db)" ;;
esac
echo "---76_MWISHO---"
