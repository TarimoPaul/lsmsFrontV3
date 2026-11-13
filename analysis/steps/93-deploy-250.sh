#!/usr/bin/env bash
# HATUA 93 (mmiliki 12/11 ge; kama 76): deploy ya backend 2.5.0 + frontend-v3 3.3.0 - SCRIPT MOJA kwa staging na prod.
#
#   bash 93-deploy-250.sh <staging|prod> hali        kusoma tu: matoleo, Flyway, image, hatua zilizokamilika
#   bash 93-deploy-250.sh <staging|prod> deploy      K1 kagua -> K2 backup -> K3 pull -> K4 kagua env/compose -> K5 badili -> K6 smoke
#                                                    INAENDELEA baada ya kukatika: kila hatua iliyokamilika imeandikwa kwenye
#                                                    ~/lsms-250/<target>/hali na inarukwa; kila hatua ni idempotent.
#   bash 93-deploy-250.sh <staging|prod> rollback    backend 2.4.0 + frontend-v3 3.2.0, .env + compose za backup.
#                                                    DB HAIRUDISHWI: V139-V151 ni za kuongeza tu (jedwali mapya, safu nullable au
#                                                    NOT NULL DEFAULT, check pana zaidi). Jaribio (ge): 2.4.0 juu ya schema 151 inawaka
#                                                    na inaandika sale/deni/reco/manunuzi bila kosa (rollback_kuandika 5/0).
#   bash 93-deploy-250.sh staging refresh-db [dump]  STAGING TU: DB <- dump ya prod (default: ~/backups/daily ya leo)
#   bash 93-deploy-250.sh <staging|prod> marejesho kagua|andika   (gy) swichi ya marejesho C4 = ON:
#                                                    kagua = kusoma tu (thamani ya .env, compose, container); andika = backup ya
#                                                    .env + compose, kisha APP_FEATURES_SALES_RETURNS_ENABLED=true kwenye .env NA
#                                                    kwenye environment ya backend ya compose; docker compose config inathibitisha
#                                                    (badiliko lolote jingine -> inarudisha backup). HAIWASHI upya container:
#                                                    inaanza kufanya kazi kwenye K5 ya deploy inayofuata (K4/K6 zinaonyesha =true).
#   (gy 4) K1 ya deploy: kila payment_method ya data dhidi ya check ya V151 (kusoma tu) KABLA ya K5 - HAIKUBALIKI > 0 -> simama.
#   (gy 1/4) K4: prod LAZIMA iwe marejesho =true (vinginevyo: endesha 'marejesho' kwanza); staging inaripoti tu.
#
# Haifuti image yoyote (de: siku ya deploy hakuna kufuta). Haiandiki thamani ya siri kwenye output.
# Majaribio (PC): L93_HOME, L93_DIR, L93_BASE, L93_SLEEP=0, L93_IMG_BE - kwa server ya kuigiza tu.
#
# (mmiliki 13/11 gt) STAGING HAITUMI NJE: K4 (kabla ya kubadili) + K6 (container inayoendesha) + hali -> ARIFA_ZIMEZIMWA au SIMAMA.
#   Njia zote za kutoka nje kwenye 2.5.0 (ukaguzi wa code 13/11): HAKUNA mail/SMS/WhatsApp/webhook/push - jar haina maktaba
#   ya mail wala HTTP client, hakuna RestTemplate/WebClient/URL.openConnection. "Arifa" (muhtasari wa mauzo 00:00 kwa
#   Macheda, sale/ununuzi/badiliko) ni safu kwenye jedwali notifications la DB YA STAGING TU - zinaonekana tu kwa anayeingia
#   staging. Schedulers zinazoandika (capex 00:05/00:10/kila mwezi, riba ya mikopo, GL health, order suggestion, audit
#   retention) zinafungwa na APP_SCHEDULERS_ENABLED=false; muhtasari wa mauzo 00:00 na kusafisha tokeni 02:00 hazina swichi
#   (zinaandika DB ya staging tu).
set -uo pipefail

TARGET="${1:-}"; ACTION="${2:-}"; ARG3="${3:-}"
H="${L93_HOME:-$HOME}"
NEW_BE=2.5.0; NEW_V3=3.3.0; OLD_BE=2.4.0; OLD_V3=3.2.0
IMG_BE=${L93_IMG_BE:-chiefmaster/my-lsms-backend}; IMG_V3=chiefmaster/lsms-frontend-v3
ROLES='CEO,Executive CEO'
ENV_ONDOA='ADMIN_EMAIL ADMIN_PASSWORD DOCKERHUB_USERNAME DOCKERHUB_PASSWORD'
FLY_OLD=138; FLY_NEW=151
FLY_LIST='139:true 140:true 141:true 142:true 143:true 144:true 145:true 146:true 147:true 148:true 149:true 150:true 151:true'
START_MARK='Started LsmsApplication'
SLEEP="${L93_SLEEP:-3}"

case "$TARGET" in
  prod)    DIR="${L93_DIR:-$H/lsms-deployment}"; PROJ=lsms-deployment; BASE="${L93_BASE:-http://localhost}"; B2=1 ;;
  staging) DIR="${L93_DIR:-$H/lsms-staging}";    PROJ=lsms-staging;    BASE="${L93_BASE:-http://127.0.0.1:8081}"; B2=0 ;;
  *) echo "MATUMIZI: $0 <staging|prod> <hali|deploy|rollback|refresh-db|marejesho kagua|andika>"; exit 2 ;;
esac
SITE_HOST=elikom.co.tz
ST="$H/lsms-250/$TARGET"; HALI="$ST/hali"; BK="$ST/backup"
mkdir -p "$ST" && chmod 700 "$H/lsms-250" "$ST" 2>/dev/null
T0=$(date +%s)
# 93 moja tu kwa wakati mmoja (kwa kila target): driver ya PC ikiunganisha tena, haianzishi ya pili
if [ "$ACTION" != hali ] && command -v flock >/dev/null; then
  exec 9>"$ST/lock"; flock -n 9 || { echo "[93 $TARGET] SIYO: 93 nyingine bado inaendesha ($ST/lock)"; echo "---93_INAENDESHA---"; exit 3; }
fi

say()  { echo "[93 $TARGET $(date +%H:%M:%S)] $*"; }
die()  { echo "[93 $TARGET $(date +%H:%M:%S)] SIYO: $*"; echo "---93_IMESHINDWA---"; exit 1; }
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
# (gt) ARIFA: staging haitumi chochote nje. arifa <tag-ya-backend> -> 0 + ARIFA_ZIMEZIMWA, au 1 + sababu.
#   1) backend ya compose ina APP_SCHEDULERS_ENABLED=false (profile prod ingeiwasha);
#   2) hakuna funguo za kutuma nje kwenye .env wala kwenye environment ya backend (majina tu, thamani hazichapishwi);
#   3) jar ya image hiyo haina maktaba ya mail / SMS / push / HTTP client (inasomwa kwenye container ya muda, --network none).
OUT_KEYS='MAIL|SMTP|SMS|WHATSAPP|TWILIO|WEBHOOK|FCM|FIREBASE|TELEGRAM|SENDGRID|BEEM|NEXTSMS|ONESIGNAL|PUSH'
OUT_LIBS='mail|twilio|firebase|okhttp|webflux|reactor-netty|httpclient|feign|retrofit|telegram|sendgrid|aws-java-sdk|amqp|kafka|onesignal'
arifa() {
  local c be sch prof keys libs n r=0
  c=$(DC config 2>/dev/null) || { say "ARIFA: docker compose config imeshindwa"; return 1; }
  be=$(awk '/^  backend:/{b=1;next} /^  [^ ]/{b=0} b' <<<"$c")
  sch=$(grep -oE 'APP_SCHEDULERS_ENABLED(:|=) *"?[A-Za-z]+' <<<"$be" | sed -E 's/.*(:|=) *"?//' | head -n1)
  prof=$(grep -oE 'SPRING_PROFILES_ACTIVE(:|=) *"?[A-Za-z,]+' <<<"$be" | sed -E 's/.*(:|=) *"?//' | head -n1)
  if [ "$sch" = false ]; then say "ARIFA 1/3: APP_SCHEDULERS_ENABLED=false kwenye backend (profile ${prof:-HAIPO})"
  else say "ARIFA 1/3 SIYO: APP_SCHEDULERS_ENABLED ya backend ni '${sch:-HAIPO}' (lazima false; profile ${prof:-HAIPO})"; r=1; fi
  keys=$( { sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' .env; grep -oE '^ +[A-Z][A-Z0-9_]*:' <<<"$be" | tr -d ' :'; } | grep -E "(^|_)($OUT_KEYS)(_|$)" | sort -u | tr '\n' ' ')
  if [ -z "$keys" ]; then say "ARIFA 2/3: hakuna funguo za kutuma nje (.env + environment ya backend)"
  else say "ARIFA 2/3 SIYO: funguo za kutuma nje zipo: $keys"; r=1; fi
  if docker image inspect "$IMG_BE:$1" >/dev/null 2>&1; then
    libs=$(docker run --rm --network none --entrypoint sh "$IMG_BE:$1" -c 'unzip -l /app/app.jar' 2>/dev/null | sed -n 's#.*BOOT-INF/lib/##p')
    n=$(grep -c . <<<"$libs")
    if [ "$n" -lt 50 ]; then say "ARIFA 3/3 SIYO: maktaba za jar ya $1 hazikusomeka ($n)"; r=1
    elif grep -iqE "$OUT_LIBS" <<<"$libs"; then say "ARIFA 3/3 SIYO: jar ya $1 ina: $(grep -iE "$OUT_LIBS" <<<"$libs" | tr '\n' ' ')"; r=1
    else say "ARIFA 3/3: jar ya $1 - maktaba $n, hakuna ya mail/SMS/push/HTTP client"; fi
  else say "ARIFA 3/3 SIYO: image $IMG_BE:$1 haipo kwenye server"; r=1; fi
  [ $r = 0 ] && say "ARIFA_ZIMEZIMWA: staging haitumi mail/SMS/WhatsApp/webhook/push; arifa za ndani (muhtasari wa mauzo 00:00 n.k.) zinaandikwa kwenye DB ya staging tu"
  return $r
}
# (gy) swichi ya marejesho (C4). Inachapishwa "JINA =thamani" (nafasi kabla ya =) ili ficha.awk isiifiche.
RET_KEY=APP_FEATURES_SALES_RETURNS_ENABLED
PM_OK="'CASH','VODACOM','TIGOPESA','HALOPESA','AIRTELMONEY','CRDB','NMB','NBC','SELCOM','PCB','CREDIT','BANK_TRANSFER','MOBILE_MONEY'"
# thamani ya KEY kwenye environment ya backend kama docker compose inavyoiona (tupu = haijawekwa -> default ya jar)
cfg_be() { awk '/^  backend:/{b=1;next} /^  [^ ]/{b=0} b' <<<"$1"; }
cfg_val() { cfg_be "$1" | grep -oE "^ +$2(:|=) *\"?[A-Za-z0-9._-]*" | head -n1 | sed -E 's/^ +[A-Z0-9_]+(:|=) *"?//'; }
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
  local hc; hc=$(DC config 2>/dev/null); say "compose: marejesho $RET_KEY =$(cfg_val "$hc" "$RET_KEY"); onyo la manunuzi =$(cfg_val "$hc" LSMS_PURCHASE_CHECK_FROM)"
  if [ "$TARGET" = staging ]; then
    local t="$NEW_BE"; docker image inspect "$IMG_BE:$NEW_BE" >/dev/null 2>&1 || t="$OLD_BE"
    arifa "$t" || say "ARIFA HAZIJAZIMWA (hali - kusoma tu; deploy itasimama K4)"
    say "cron za mtumiaji zinazotaja lsms-staging: $(crontab -l 2>/dev/null | grep -v '^ *#' | grep -c lsms-staging) (taarifa)"
  fi
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
    # baada ya rollback (K2 ipo) schema tayari ina V139-V151
    if done_k K2-BACKUP; then
      [ "$fm" = "$FLY_OLD" ] || [ "$fm" = "$FLY_NEW" ] || die "Flyway inatarajiwa $FLY_OLD au $FLY_NEW (baada ya rollback), ni '$fm'"
    else
      [ "$fm" = "$FLY_OLD" ] || die "Flyway inatarajiwa $FLY_OLD kabla ya deploy, ni '$fm'"
    fi
  fi
  if ! done_k K5-BADILI; then
    # (gy 4) V151 inaongeza CHECK ya payment_method: thamani yoyote ya data nje ya orodha ingefanya Flyway ya K5 ishindwe
    local pm; pm=$(psql_q "select (select count(*) from payments where payment_method is not null and payment_method not in ($PM_OK)) || ' ' || (select count(*) from credit_payments where payment_method is not null and payment_method not in ($PM_OK)) || ' ' || (select count(*) from payments) || ' ' || (select count(*) from credit_payments)")
    set -- $pm
    [ "${1:-x}" = 0 ] && [ "${2:-x}" = 0 ] || die "payment_method dhidi ya V151: HAIKUBALIKI payments ${1:-?} / credit_payments ${2:-?} - K5 ingeshindwa; HAKUNA kilichobadilishwa"
    say "payment_method dhidi ya V151: HAIKUBALIKI 0 (payments $3, credit_payments $4)"
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
  local D="$BK/lsms_kabla_250_$(date +%Y%m%d_%H%M%S).dump"
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

# ═════════════════════════════════════════ K4 KAGUA ENV + COMPOSE (kusoma tu) ═══════════════════════════════
# 2.5.0 HAIBADILISHI .env wala compose. Swichi mpya zina default salama ndani ya jar na HAZIWEKWI kwenye .env:
#   APP_FEATURES_SALES_RETURNS_ENABLED (C4, default false - Chief anawasha baadaye), LSMS_PURCHASE_CHECK_FROM (6e, default 2026-12-02).
# Uthibitisho: hali ya 2.4.0 bado ipo (ROLES ipo, ADMIN_*/DOCKERHUB_* hazipo); marejesho hayajawashwa kwenye compose.
k4() {
  done_k K4-KAGUA && { say "K4-KAGUA ilishakamilika - inarukwa"; return 0; }
  anza K4-KAGUA
  grep -q '^DAILY_SALES_PROFIT_ROLES=' .env || die ".env haina DAILY_SALES_PROFIT_ROLES (hali ya 2.4.0)"
  local k; for k in $ENV_ONDOA; do grep -q "^$k=" .env && die ".env bado ina $k"; done
  local c; c=$(DC config 2>/dev/null) || die "docker compose config imeshindwa"
  local rv pv; rv=$(cfg_val "$c" "$RET_KEY"); pv=$(cfg_val "$c" LSMS_PURCHASE_CHECK_FROM)
  say "marejesho $RET_KEY =${rv:-HAIJAWEKWA (default ya jar: false)}"
  say "onyo la manunuzi LSMS_PURCHASE_CHECK_FROM =${pv:-HAIJAWEKWA (default ya jar: 2026-12-02)}"
  if [ "$TARGET" = prod ] && [ "$rv" != true ]; then die "(gy) prod: marejesho lazima yawe =true kuanzia deploy hii - endesha kwanza: 93-deploy-250.cmd prod marejesho"; fi
  say ".env + compose: BACKEND_VERSION / FRONTEND_V3_VERSION zinabadilishwa na K5; swichi kama zilivyo hapo juu"
  if [ "$TARGET" = staging ]; then arifa "$NEW_BE" || die "ARIFA HAZIJAZIMWA - staging ingeweza kutuma nje; HAKUNA kilichobadilishwa (rekebisha .env ya staging, kisha deploy tena)"; fi
  mark K4-KAGUA
}

# ═════════════════════════════════════════ K5 BADILI (2.5.0 + 3.3.0 pamoja) ═════════════════════════════════
k5() {
  if done_k K5-BADILI; then
    # (gy) .env/compose zikibadilika baada ya K5 (k.m. marejesho andika) compose inaunda upya container; vinginevyo haigusi kitu
    local c0 c1; c0=$(DC ps -q backend | head -n1); UP_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    DC up -d --no-deps backend frontend-v3 || die "compose up (K5 iliyokamilika) imeshindwa"
    c1=$(DC ps -q backend | head -n1)
    if [ "$c0" = "$c1" ]; then UP_TS=; say "K5-BADILI ilishakamilika - config haijabadilika, nakagua health tu"
    else say "K5-BADILI ilishakamilika - .env/compose zimebadilika: backend imeundwa upya"; fi
    health "$NEW_BE" "$NEW_V3" || { rollback_core; die "health baada ya resume imeshindwa - ROLLBACK imefanyika"; }; return 0
  fi
  anza K5-BADILI
  echo "$OLD_BE" > .backend.prev; echo "$OLD_V3" > .frontend-v3.prev
  set_line BACKEND_VERSION "$NEW_BE" && set_line FRONTEND_V3_VERSION "$NEW_V3" || { rollback_core; die ".env haikubadilika salama - ROLLBACK"; }
  UP_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)   # log za container hii tu tangu sasa (si "Started" ya zamani)
  DC up -d --no-deps backend frontend-v3 || { rollback_core; die "compose up imeshindwa - ROLLBACK"; }
  if ! health "$NEW_BE" "$NEW_V3"; then rollback_core; die "$NEW_BE/$NEW_V3 hazikupita health - ROLLBACK imefanyika"; fi
  local fm; fm=$(fly_max)
  local ok; ok=$(psql_q "select string_agg(version||':'||success, ' ' order by version::int) from flyway_schema_history where version ~ '^[0-9]+\$' and version::int between 139 and 151")
  say "Flyway: $ok (max $fm)"
  [ "$fm" = "$FLY_NEW" ] && [ "$ok" = "$FLY_LIST" ] || { rollback_core; die "Flyway si 139-151 zote true - ROLLBACK"; }
  mark K5-BADILI
}

# ═════════════════════════════════════════ K6 SMOKE (seva) ═════════════════════════════════════════════════
k6() {
  anza K6-SMOKE
  health "$NEW_BE" "$NEW_V3" || die "smoke: health SIYO (rollback: bash $0 $TARGET rollback)"
  local cid t a; cid=$(DC ps -q backend | head -n1)
  for t in gl_control_snapshot annual_prepayment liability_payment pour_container pour_use staff_liability_agreement capex_ops_report_exclusion_log; do
    [ "$(psql_q "select to_regclass('public.$t') is not null")" = t ] || die "jedwali $t halipo"; done
  for a in 1160 2310 2910 6130; do
    [ "$(psql_q "select count(*) from gl_account where account_code='$a'")" = 1 ] || die "akaunti $a haipo"; done
  [ "$(psql_q "select count(*) from pg_constraint where conname='payments_payment_method_check' and pg_get_constraintdef(oid) like '%SELCOM%'")" = 1 ] || die "check ya V151 (SELCOM) haipo"
  say "jedwali 7 mapya + akaunti 1160/2310/2910/6130 + check ya V151 SAWA"
  [ "$(psql_q "select coalesce(bank_cutover_date::text,'HAIJAWEKWA') from gl_config order by id limit 1")" = HAIJAWEKWA ] && say "D: HAIJAWEKWA (inawekwa na hatua 60 tarehe 07/12)" || say "ONYO: D IMEWEKWA tayari"
  local rc6; rc6=$(docker exec "$cid" printenv "$RET_KEY" 2>/dev/null | tr -dc 'a-z')
  say "marejesho kwenye container inayoendesha: $RET_KEY =${rc6:-HAIJAWEKWA (default ya jar: false)}"
  if [ "$TARGET" = prod ] && [ "$rc6" != true ]; then die "(gy) prod: container haina marejesho =true (rollback: bash $0 $TARGET rollback)"; fi
  local later; later=$(docker logs "$cid" 2>&1 | sed "1,/$START_MARK/d" | grep -cE ' (ERROR|FATAL) ')
  say "ERROR baada ya kuanza (maombi ya moja kwa moja): $later"
  if [ "$TARGET" = staging ]; then
    local se; se=$(docker exec "$cid" printenv APP_SCHEDULERS_ENABLED 2>/dev/null | tr -dc 'a-z')
    [ "$se" = false ] || die "ARIFA: container ya backend inaendesha na APP_SCHEDULERS_ENABLED='${se:-HAIPO}' (rollback: bash $0 $TARGET rollback)"
    say "ARIFA_ZIMEZIMWA (container inayoendesha: APP_SCHEDULERS_ENABLED=false)"
  fi
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
  say "Flyway ya mwisho: $(fly_max) (DB HAIJARUDISHWA - V139-V151 ni za kuongeza; 2.4.0 inaziandikia bila kosa - jaribio ge)"
  unmark K4-KAGUA; unmark K5-BADILI; unmark K6-SMOKE; unmark K3-PULL
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
  say "REFRESH-DB SAWA ($(( $(date +%s) - KT ))s); hali ya 93 ya staging imefutwa (deploy itaanza K1)"
}

# ═════════════════════════════════════════ MAREJESHO (gy): KAGUA -> (PC: 🛑 ANDIKA) -> ANDIKA ═══════════════════
marejesho() {
  local mode="$1" c v e ef st n
  c=$(DC config 2>/dev/null) || die "docker compose config imeshindwa"
  v=$(cfg_val "$c" "$RET_KEY"); e=$(envv "$RET_KEY")
  ef=$(grep -lE "^ +(- )?$RET_KEY[:=]" $COMPOSE_FILES 2>/dev/null | head -n1)
  say "KAGUA: .env $RET_KEY =${e:-HAIPO} | compose (backend) =${v:-HAIJAWEKWA} | compose inayoitaja: ${ef:-HAKUNA}"
  say "KAGUA: container ya backend $(tag_of backend): $RET_KEY =$(docker exec "$(DC ps -q backend | head -n1)" printenv "$RET_KEY" 2>/dev/null | tr -dc 'a-z')"
  if [ "$v" = true ] && [ "$e" = true ]; then say "MAREJESHO_TAYARI =true (.env + compose) - hakuna cha kuandika"; return 0; fi
  [ "$mode" = andika ] || { say "MAREJESHO_KAGUA_OK: ANDIKA itaweka .env $RET_KEY =true na mstari wake kwenye environment ya backend (docker-compose.yml)"; return 0; }
  KT=$(date +%s); st="$ST/marejesho-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$st"
  cp -p .env $COMPOSE_FILES "$st/" || die "backup ya .env/compose imeshindwa"
  printf '%s\n' "$c" > "$st/config-kabla.yml"
  say "backup: $st"
  restore() { cp -p "$st/.env" .env; local f; for f in $COMPOSE_FILES; do cp -p "$st/$f" "$f"; done; }
  # .env
  if grep -q "^$RET_KEY=" .env; then set_line "$RET_KEY" true || { restore; die ".env: kuweka $RET_KEY kumeshindwa - imerudishwa"; }
  else [ -z "$(tail -c1 .env)" ] || echo >> .env; echo "$RET_KEY=true" >> .env; fi
  # compose: mstari ndani ya environment ya backend (mtindo wa orodha "- K=V" au ramani "K: V", kama mistari iliyopo)
  if [ -z "$ef" ]; then
    awk -v k="$RET_KEY" '
      function ind(s) { match(s, /^ */); return RLENGTH }
      { lines[NR] = $0 }
      END {
        for (i = 1; i <= NR; i++) {
          print lines[i]
          if (!done && lines[i] ~ /^ +backend:[ \t]*$/) { inb = 1; bi = ind(lines[i]); continue }
          if (inb && lines[i] !~ /^[ \t]*$/ && ind(lines[i]) <= bi) inb = 0
          if (!done && inb && lines[i] ~ /^ +environment:[ \t]*$/) {
            j = i + 1; while (j <= NR && lines[j] ~ /^[ \t]*$/) j++
            e = substr(lines[j], 1, ind(lines[j]))
            if (lines[j] ~ /^ *- /) print e "- " k "=${" k ":-false}"; else print e k ": ${" k ":-false}"
            done = 1
          }
        }
        if (!done) exit 3
      }' docker-compose.yml > "$st/compose-mpya.yml" || { restore; die "docker-compose.yml: environment ya backend haikupatikana - imerudishwa, HAKUNA kilichobadilishwa"; }
    cp "$st/compose-mpya.yml" docker-compose.yml
  fi
  # uthibitisho: config mpya = config ya zamani + mstari huu tu, na backend =true
  local c2; c2=$(DC config 2>/dev/null) || { restore; die "docker compose config baada ya kuandika imeshindwa - imerudishwa"; }
  if [ "$(cfg_val "$c2" "$RET_KEY")" != true ] || ! diff -q <(grep -v "$RET_KEY" <<<"$c") <(grep -v "$RET_KEY" <<<"$c2") >/dev/null; then
    diff <(grep -v "$RET_KEY" <<<"$c") <(grep -v "$RET_KEY" <<<"$c2") | head -5 | sed 's/^/[diff] /'
    restore; die "config baada ya kuandika si sawa (au si =true) - .env + compose zimerudishwa"
  fi
  n=$(diff "$st/config-kabla.yml" <(printf '%s\n' "$c2") | grep -c '^[<>]')
  say "ANDIKA SAWA: compose (backend) $RET_KEY =true; config imebadilika mstari $n tu; backup $st"
  unmark K4-KAGUA; unmark K6-SMOKE
  say "MAREJESHO_IMEANDIKWA: inaanza kufanya kazi kwenye deploy inayofuata (K4 / K6 zitaonyesha =true); container ya sasa haijaguswa"
}

case "$ACTION" in
  marejesho)  [ "$ARG3" = kagua ] || [ "$ARG3" = andika ] || die "marejesho kagua|andika"; marejesho "$ARG3" ;;
  hali)       hali ;;
  deploy)     k1; k2; k3; k4; k5; k6; hali; say "DEPLOY_OK $NEW_BE + $NEW_V3 (jumla $(( $(date +%s) - T0 ))s)" ;;
  rollback)   rollback_core || { echo "---93_IMESHINDWA---"; exit 1; }; hali ;;
  refresh-db) refresh_db ;;
  *) die "kitendo '$ACTION' hakijulikani (hali|deploy|rollback|refresh-db|marejesho)" ;;
esac
echo "---93_MWISHO---"
