#!/usr/bin/env bash
# HATUA 45a - PREFLIGHT YA §1.8 - inaendeshwa KWENYE CONTABO na 45a-prod-preflight.cmd (scp kwenda /tmp; output -> ficha.awk).
# Matumizi: bash 45a-prod-preflight.sh <USIKU|ASUBUHI> <HH:MM ya freeze, EAT>
# KUSOMA TU kwa prod isipokuwa: ~/backup-lsms.sh (script ya backup iliyopo, ileile ya kila deploy) inaendeshwa mara moja ili
# kupata DUMP MPYA ya baada ya freeze (pg_dump; nakala B2). Hakuna query kwenye DB ya prod (kanuni ya 15/10), hakuna container
# ya prod inayobadilishwa (ps / inspect / logs tu).
# Kinachoandikwa: dump mpya ~/backups/daily/<jina> + B2 (na script ya backup; 45a inapakia B2 yenyewe ikiwa script haikupakia),
# /tmp/staging-restore/{JINA, <dump mpya>, FLYWAY.txt} (nakala ya B2 ya dump mpya, kwa 45b) na faili za muda (zinafutwa).
# Mwisho: ---OK--- au ---IMESHINDWA-KWENYE: <sehemu> (exit N)---. Ishara (si mistari ya .env) ndizo PC inalinganisha.
set -u -o pipefail
STEP=""
fail() { echo "---IMESHINDWA-KWENYE: $STEP (exit ${1:-1})---"; exit 1; }
section() { STEP="$1"; echo "---$1---"; }
WANT_DIGEST="sha256:047084562507162306daf153adbcf3b00884883b6f84f860f0c8461c3ece35d2"   # 37 BUILD_OK 2.2.71 = 38c staging
IMG="chiefmaster/my-lsms-backend"
B2="b2:elikom-lsms-backups/daily"
MODE="${1:-}"; FREEZE="${2:-}"
eat() { TZ=Africa/Dar_es_Salaam date "$@"; }

section "DIRISHA (usiku 02:30-05:59; mchana 06:00-13:59 kwa kibali cha mmiliki ASUBUHI)"
NOW=$(eat +%H%M)
echo "saa ya Tanzania: $(eat '+%Y-%m-%d %H:%M') - dirisha lililoombwa: ${MODE:-HAKUNA}"
case "$MODE" in USIKU|ASUBUHI) ;; *) echo "SIYO: dirisha lazima liwe USIKU au ASUBUHI"; fail 1 ;; esac
if [ "$NOW" -ge 0230 ] 2>/dev/null && [ "$NOW" -le 0559 ]; then echo "dirisha la usiku"; echo DIRISHA_SAWA
elif [ "$MODE" = ASUBUHI ] && [ "$NOW" -ge 0600 ] && [ "$NOW" -le 1359 ]; then echo "dirisha la mchana kwa kibali cha mmiliki (45d inakataa kuanza kuanzia 14:00)"; echo DIRISHA_SAWA
else echo "SIYO: §1.8 inaruhusiwa 02:30-05:59 EAT, au 06:00-13:59 EAT kwa kibali cha ASUBUHI"; fail 1; fi

D1=$(TZ=Africa/Dar_es_Salaam date +%F); D2=$(TZ=Africa/Dar_es_Salaam date +%Y%m%d)
J="lsms_${D2}_0200.dump"

section "BACKUP-LOG-YA-LEO (OK + UPLOADED lazima)"
# Njia za log zinasomwa kutoka crontab na ~/backup-lsms.sh (haibuniwi). KILA njia inakaguliwa: faili lisilokuwepo, tupu au
# lisilo na mstari wa leo linarukwa (linaandikwa hapa). Inatumika ya kwanza ambayo kipande chake cha leo kina OK + UPLOADED.
# Kipande cha leo chenye FAIL/ERROR kwenye log YOYOTE = SIMAMA. Hakuna log yenye mstari wa leo = SIMAMA.
LOGP=""; TODAY_PART=""; NA_LEO=0
CANDS=$( { crontab -l 2>/dev/null | grep -i backup | grep -oE '>>?[[:space:]]*[^[:space:];&|]+\.log' | sed -E 's/^>>?[[:space:]]*//'
           grep -oE '[~$A-Za-z0-9_./{}-]+\.log' ~/backup-lsms.sh 2>/dev/null; } | sed "s|^~|$HOME|; s|\${HOME}|$HOME|; s|\$HOME|$HOME|" | awk '!s[$0]++')
echo "njia zilizotajwa na crontab/backup-lsms.sh: $(echo $CANDS)"
for f in $CANDS; do
  if [ ! -f "$f" ]; then echo "IMERUKWA $f - haipo"; continue; fi
  INFO="$(stat -c '%s bytes, %y' "$f" | cut -c1-40)"
  if [ ! -s "$f" ]; then echo "IMERUKWA $f ($INFO) - faili tupu"; continue; fi
  P=$(awk -v a="$D1" -v b="$D2" 'f || index($0, a) || index($0, b) {f=1; print}' "$f")
  if [ -z "$P" ]; then echo "IMERUKWA $f ($INFO) - la zamani, halina mstari wa leo ($D1 / $D2)"; continue; fi
  NA_LEO=$((NA_LEO + 1))
  if echo "$P" | grep -qiE '(^|[^A-Za-z])(FAIL|FAILED|ERROR)([^A-Za-z]|$)'; then
    echo "$P" | tail -25 | cut -c1-200; echo "SIYO: $f - kipande cha leo kina FAIL/ERROR"; fail 1; fi
  if echo "$P" | grep -qE '(^|[^A-Za-z])OK([^A-Za-z]|$)' && echo "$P" | grep -q 'UPLOADED'; then
    if [ -z "$LOGP" ]; then LOGP="$f"; TODAY_PART="$P"; echo "INATUMIKA $f ($INFO) - mstari wa leo + OK + UPLOADED"
    else echo "PIA SAWA $f ($INFO) - mstari wa leo + OK + UPLOADED"; fi
  else echo "IMERUKWA $f ($INFO) - ina mstari wa leo lakini haina OK + UPLOADED"; fi
done
[ "$NA_LEO" -gt 0 ] || { echo "SIYO: hakuna log ya backup yenye mstari wa leo ($D1 / $D2)"; fail 1; }
[ -n "$LOGP" ] || { echo "SIYO: log zenye mstari wa leo hazina OK + UPLOADED"; fail 1; }
echo "log ya backup: $LOGP"
echo "$TODAY_PART" | tail -25 | cut -c1-200
echo BACKUP_LOG_LEO_OK_UPLOADED

section "DUMP-YA-0200-CONTABO-NA-B2"
L="$HOME/backups/daily/$J"
[ -f "$L" ] || { echo "SIYO: $L haipo"; fail 1; }
SZ=$(stat -c %s "$L"); echo "contabo: $J $SZ bytes, $(stat -c %y "$L" | cut -c1-19)"
[ "$SZ" -gt $((5 * 1024 * 1024)) ] || { echo "SIYO: dump ni ndogo kuliko 5MB"; fail 1; }
H1=$(sha256sum "$L" | cut -d' ' -f1); H2=$(rclone cat "$B2/$J" 2>/dev/null | sha256sum | cut -d' ' -f1)
echo "sha256 contabo $H1"; echo "sha256 b2      $H2"
[ -n "$H2" ] && [ "$H2" != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" ] || { echo "SIYO: $J haipo / tupu kwenye B2"; fail 1; }
[ "$H1" = "$H2" ] && echo DUMP_LEO_B2_SAWA || { echo "SIYO: nakala ya B2 ya dump ya 02:00 si sawa"; fail 1; }

section "FREEZE (mmiliki amesimamisha matumizi ya LSMS)"
echo "$FREEZE" | grep -qxE '([01][0-9]|2[0-3]):[0-5][0-9]' || { echo "SIYO: saa ya freeze si HH:MM"; fail 1; }
FZ=$(eat -d "$D1 $FREEZE" +%s) || fail 1
[ "$FZ" -le "$(date +%s)" ] || { echo "SIYO: saa ya freeze $FREEZE bado haijafika"; fail 1; }
echo "FREEZE_TANGU $D1 $FREEZE EAT"
echo "FREEZE_EPOCH $FZ"
echo FREEZE_SAWA

section "DUMP-MPYA-BAADA-YA-FREEZE (~/backup-lsms.sh)"
[ -x "$HOME/backup-lsms.sh" ] || { echo "SIYO: ~/backup-lsms.sh haipo au haiwezi kuendeshwa"; fail 1; }
LSZ=$(stat -c %s "$LOGP" 2>/dev/null || echo 0)
T0=$(date +%s); sleep 1
echo "inaanza: $(eat '+%H:%M:%S') EAT"
"$HOME/backup-lsms.sh" < /dev/null > /tmp/45a-backup-out.txt 2>&1; BRC=$?
NEWLOG=$( { cat /tmp/45a-backup-out.txt; tail -c +$((LSZ + 1)) "$LOGP" 2>/dev/null; } )
rm -f /tmp/45a-backup-out.txt
echo "$NEWLOG" | tail -20 | cut -c1-200
echo "imeisha: $(eat '+%H:%M:%S') EAT - exit $BRC"
[ "$BRC" = 0 ] || { echo "SIYO: ~/backup-lsms.sh exit $BRC"; fail 1; }
echo "$NEWLOG" | grep -qiE '(^|[^A-Za-z])(FAIL|FAILED|ERROR)([^A-Za-z]|$)' && { echo "SIYO: output ya backup mpya ina FAIL/ERROR"; fail 1; }
NJ=$(cd ~/backups/daily && ls -1t lsms_*.dump 2>/dev/null | head -n1)
[ -n "$NJ" ] && [ "$NJ" != "$J" ] || { echo "SIYO: hakuna dump mpya"; fail 1; }
NL="$HOME/backups/daily/$NJ"
[ "$(stat -c %Y "$NL")" -ge "$T0" ] && [ "$(stat -c %Y "$NL")" -gt "$FZ" ] || { echo "SIYO: dump mpya zaidi $NJ si ya baada ya freeze / ya sasa"; fail 1; }
NSZ=$(stat -c %s "$NL"); echo "dump mpya: $NJ $NSZ bytes, $(stat -c %y "$NL" | cut -c1-19)"
[ "$NSZ" -gt $((5 * 1024 * 1024)) ] || { echo "SIYO: dump mpya ni ndogo kuliko 5MB"; fail 1; }
(cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_restore --list < "$NL" > /dev/null) || { echo "SIYO: pg_restore --list haisomi dump mpya"; fail 1; }
echo BACKUP_MPYA_SAWA
echo "DUMP_MPYA_EPOCH $T0"

section "DUMP-MPYA-B2-NA-SHA256"
if rclone lsl "$B2/$NJ" 2>/dev/null | grep -q .; then echo "B2: script ya backup imepakia $NJ"
else echo "B2: $NJ haipo - 45a inapakia"; rclone copyto "$NL" "$B2/$NJ" || fail $?; echo "UPLOADED_NA_45A $NJ"; fi
rm -rf /tmp/staging-restore && mkdir -p /tmp/staging-restore && echo "$NJ" > /tmp/staging-restore/JINA || fail $?
rclone copyto "$B2/$NJ" "/tmp/staging-restore/$NJ" || fail $?
NH1=$(sha256sum "$NL" | cut -d' ' -f1); NH2=$(sha256sum "/tmp/staging-restore/$NJ" | cut -d' ' -f1)
echo "sha256 contabo $NH1"; echo "sha256 b2      $NH2"
[ "$NH1" = "$NH2" ] || { echo "SIYO: nakala ya B2 ya dump mpya si sawa"; fail 1; }
echo "DUMP_MPYA_JINA $NJ"
echo "DUMP_MPYA_SHA256 $NH1"
echo DUMP_MPYA_B2_SHA256_SAWA
J="$NJ"

section "PROD-FLYWAY-KUTOKA-DUMP-MPYA-LAZIMA-133 (si DB ya prod)"
cd ~/lsms-staging || fail 1
docker compose -p lsms-staging exec -T postgres pg_restore -l < "/tmp/staging-restore/$J" | grep -c 'TABLE DATA' | sed 's/^/TABLE DATA: /' || fail $?
docker compose -p lsms-staging exec -T postgres pg_restore --data-only -n public -t flyway_schema_history -f - < "/tmp/staging-restore/$J" \
  | awk -F'\t' '/^COPY /{f=1;next} f && NF>=10 && $2 ~ /^[0-9]+$/ && $10 ~ /^t$/ {print $2+0}' | sort -n | tail -3 > /tmp/staging-restore/FLYWAY.txt || fail $?
sed 's/^/dump flyway: /' /tmp/staging-restore/FLYWAY.txt
[ "$(tail -1 /tmp/staging-restore/FLYWAY.txt)" = "133" ] && echo DUMP_FLYWAY_133_SAWA || fail 1

section "PROD-LAZIMA-2.2.70"
cd ~/lsms-deployment || fail 1
docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}' || fail $?
docker compose ps backend --format '{{.Image}}' | grep -qx "$IMG:2.2.70" && echo PROD_2270_SAWA || fail 1
echo "env ya prod TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9')"
[ "$(grep -c '^BACKEND_VERSION=' .env)" = 1 ] && grep -qx 'BACKEND_VERSION=2.2.70' .env && echo PROD_ENV_2270_SAWA || fail 1

section "DIGEST-YA-2.2.71 = YA STAGING (38c)"
GOT=$(docker image inspect "$IMG:2.2.71" --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>/dev/null | sed -n "s|^$IMG@||p" | head -1)
echo "image ya server $IMG:2.2.71: ${GOT:-HAIPO}"
SCID=$(cd ~/lsms-staging && docker compose -p lsms-staging ps -q backend)
SIMG=$(docker inspect --format '{{.Image}}' "$SCID" 2>/dev/null); PIMG=$(docker image inspect --format '{{.Id}}' "$IMG:2.2.71" 2>/dev/null)
echo "staging backend inaendesha image id ${SIMG:0:19} ; $IMG:2.2.71 = ${PIMG:0:19}"
[ "$GOT" = "$WANT_DIGEST" ] && [ -n "$SIMG" ] && [ "$SIMG" = "$PIMG" ] && echo DIGEST_2271_SAWA_NA_STAGING || { echo "SIYO: digest si $WANT_DIGEST au staging haiendeshi image hiyo"; fail 1; }

section "MAOMBI-YA-KUANDIKA-TANGU-DUMP-MPYA (nginx ya prod - yakiwa zaidi ya 0, SIMAMA)"
# Mmiliki 21/10 (11:3x): kipimo kinaanzia muda wa DUMP MPYA ($T0), si freeze - maandishi ya kabla ya dump yamo ndani ya dump.
# Ombi la majaribio linatafutwa kwa alama yake kwenye kila chanzo (majaribio 3); muhtasari wa tangu freeze ni taarifa tu.
# >>> nakala ya 45-maandishi.sh (bunda45a.py) >>>
cat > /tmp/45a-maandishi.sh <<'MAANDISHI_EOF'
#!/usr/bin/env bash
# KINGA YA §1.8 (mmiliki 21/10): HAKUNA ombi la kuandika kwenye API ya prod tangu DUMP MPYA ya 45a.
# Matumizi (kwenye Contabo): bash 45-maandishi.sh <epoch ya kuanza kwa dump mpya> <epoch ya freeze ya mmiliki>
# Inaendeshwa na 45a (ndani ya 45a-prod-preflight.sh - nakala ileile), 45d, 46a, 46b, 43 na 47. KUSOMA TU: log za nginx +
# maombi ya majaribio POST /api/auth/login?lsms18probe=<tok> (body {} -> 400; hayaandiki chochote).
#  1) Ombi la majaribio kwa njia 3 (public https://elikom.co.tz, na nginx ya origin moja kwa moja http/https 127.0.0.1),
#     kisha linatafutwa (kwa alama yake) kwenye log za stdout za KILA service ya ~/lsms-deployment na faili za
#     /var/log/nginx/*.log za kila container yenye nginx. Majaribio 3 (sek 3, 6, 10 za flush). Lisipoonekana = SIMAMA.
#  2) Chanzo kilichoonyesha alama ndicho kinasomwa. Mstari wa majaribio lazima usomeke kwa muundo wa log
#     (IP [saa] "METHOD njia ...") - vinginevyo SIMAMA (muundo usiojulikana = hesabu isiyoaminika).
#  3) POST/PUT/PATCH/DELETE kwenye /api tangu dump, bila /api/auth/login, /api/auth/refresh, majaribio, na maombi ya
#     hatua za §1.8 zenyewe (User-Agent lsms-18/<script>; ikiwa log haina User-Agent: njia za GL za 46/43/47 tu).
#     > 0 = SIMAMA na kuorodhesha (saa, IP, njia).
#  4) TAARIFA TU: maombi yote tangu freeze kwa METHOD, njia na IP (kifaa kipi bado kiko kwenye LSMS).
# Ishara: NGINX_LOG_INAFANYA_KAZI, MAANDISHI_TANGU_DUMP_HAKUNA (na MAANDISHI_TANGU_FREEZE_HAKUNA - jina la zamani la 45a).
set -u -o pipefail
DE="${1:-}"; FZ="${2:-}"
echo "$DE" | grep -qxE '[0-9]{9,11}' && echo "$FZ" | grep -qxE '[0-9]{9,11}' || { echo "SIYO: epoch ya dump / freeze si sahihi: [$DE] [$FZ]"; exit 1; }
[ "$FZ" -le "$DE" ] || { echo "SIYO: freeze ni baada ya dump"; exit 1; }
cd ~/lsms-deployment || exit 1
eat() { TZ=Africa/Dar_es_Salaam date "$@"; }
W=$(mktemp -d /tmp/45-maandishi.XXXXXX) || exit 1
trap 'rm -rf "$W"' EXIT
echo "dump mpya ilianza: $(eat -d "@$DE" '+%F %H:%M:%S') EAT; freeze: $(eat -d "@$FZ" '+%F %H:%M:%S') EAT; sasa: $(eat '+%H:%M:%S') EAT"

SVCS=$(docker compose ps --services --status running 2>/dev/null)
[ -n "$SVCS" ] || { echo "SIYO: docker compose ps haikuonyesha service zinazoendesha"; exit 1; }
NGX=""
for s in $SVCS; do docker compose exec -T "$s" sh -c 'command -v nginx' < /dev/null > /dev/null 2>&1 && NGX="$NGX $s"; done
echo "service zinazoendesha: $(echo $SVCS) | zenye nginx:${NGX:- HAKUNA}"

# chanzo: stdout:<service> au file:<service>:<njia>
soma() {   # soma <chanzo> <iso ya tangu> -> mistari (bila kiambishi cha compose)
  case "$1" in
    stdout:*) docker compose logs --no-color --since "$2" "${1#stdout:}" 2>/dev/null | sed -E 's/^[^|]*\| //' ;;
    file:*) local r="${1#file:}"; docker compose exec -T "${r%%:*}" sh -c "tail -n 200000 '${r#*:}'" < /dev/null 2>/dev/null ;;
  esac
}
vyanzo() {
  for s in $SVCS; do echo "stdout:$s"; done
  for s in $NGX; do
    docker compose exec -T "$s" sh -c 'for f in /var/log/nginx/*.log $(nginx -T 2>/dev/null | sed -nE "s/^[[:space:]]*access_log[[:space:]]+([^ ;]+).*/\1/p"); do [ -f "$f" ] && [ ! -L "$f" ] && echo "$f"; done' < /dev/null 2>/dev/null \
      | awk '!s[$0]++' | sed "s|^|file:$s:|"
  done
}

section_probe() {
  TOK="$(date +%s)$RANDOM"
  PSINCE=$(date -u -d "-20 sec" +%Y-%m-%dT%H:%M:%SZ)
  for k in public origin80 origin443; do
    case $k in
      public) U="https://elikom.co.tz"; X="" ;;
      origin80) U="http://127.0.0.1"; X="-H Host:elikom.co.tz" ;;
      origin443) U="https://127.0.0.1"; X="-k -H Host:elikom.co.tz" ;;
    esac
    C=$(curl -s -o /dev/null -m 15 -w '%{http_code}' $X -A "lsms-18-probe-$k" -X POST -H 'Content-Type: application/json' -d '{}' "$U/api/auth/login?lsms18probe=$TOK$k" 2>/dev/null | tr -dc '0-9')
    echo "  majaribio $k: HTTP_${C:-000}"
  done
}

SRC=""; PLINE=""; PK=""
for jaribio in 1 2 3; do
  echo "ombi la majaribio - jaribio $jaribio ya 3"
  section_probe
  case $jaribio in 1) sleep 3 ;; 2) sleep 6 ;; 3) sleep 10 ;; esac
  for v in $(vyanzo); do
    soma "$v" "$PSINCE" > "$W/v.txt"
    for k in public origin80 origin443; do
      L=$(grep -F "lsms18probe=$TOK$k" "$W/v.txt" | tail -n 1)
      [ -n "$L" ] || continue
      echo "  alama ya $k IMEONEKANA kwenye $v"
      if [ -z "$SRC" ] || { [ "$k" = public ] && [ "$PK" != public ]; }; then SRC="$v"; PLINE="$L"; PK="$k"; fi
    done
  done
  [ -n "$SRC" ] && break
done
if [ -z "$SRC" ]; then
  echo "SIYO: ombi la majaribio halikuonekana kwenye chanzo chochote baada ya majaribio 3 - freeze haiwezi kuthibitishwa"
  for v in $(vyanzo); do echo "  $v: mistari tangu freeze $(soma "$v" "$(date -u -d "@$FZ" +%Y-%m-%dT%H:%M:%SZ)" | grep -c .); 2 ya mwisho:"; soma "$v" "$PSINCE" | tail -n 2 | cut -c1-220 | sed 's/^/    /'; done
  for s in $NGX; do echo "  access_log za $s:"; docker compose exec -T "$s" sh -c 'nginx -T 2>/dev/null | grep -E "^[[:space:]]*(access_log|log_format)"' < /dev/null 2>/dev/null | cut -c1-200 | sed 's/^/    /'; done
  exit 1
fi
echo "chanzo cha log: $SRC (ombi la $PK)"
echo "mstari wa majaribio: $(echo "$PLINE" | cut -c1-260)"
[ "$PK" = public ] || echo "TAHADHARI: ombi la public (https://elikom.co.tz) halikuonekana; la origin ($PK) limeonekana - angalia muhtasari wa IP hapa chini kuona kama vifaa vinapita nginx hii"

# muundo: <ip> ... [<saa>] "<METHOD> <njia> HTTP/x" <status> ...
PARSE='^([^ ]+) [^[]*\[([^]]+)\] "([A-Z]+) ([^ "]+)[^"]*" ([0-9]{3})'
echo "$PLINE" | grep -qE "$PARSE" || { echo "SIYO: muundo wa log haujulikani (mstari wa majaribio hausomeki) - hesabu haiaminiki"; exit 1; }
UA_IPO=0; echo "$PLINE" | grep -qF "lsms-18-probe-" && UA_IPO=1
echo "User-Agent kwenye log: $([ $UA_IPO = 1 ] && echo NDIYO || echo HAPANA)"

if [ "${SRC%%:*}" = stdout ]; then
  ST=$(docker inspect -f '{{.State.StartedAt}}' "$(docker compose ps -q "${SRC#stdout:}" | head -n1)" 2>/dev/null)
  echo "container ya $SRC ilianza: $ST"
  [ -n "$ST" ] && [ "$(date -d "$ST" +%s)" -lt "$DE" ] || { echo "SIYO: container ya log ilianza baada ya dump - log ya tangu dump haijakamilika"; exit 1; }
fi

SINCE_FZ=$(date -u -d "@$FZ" +%Y-%m-%dT%H:%M:%SZ)
soma "$SRC" "$SINCE_FZ" | grep -E "$PARSE" | grep -v 'lsms18probe=' > "$W/raw.txt"
# epoch kwa kila mstari (mara moja kwa sekunde ileile - cache)
awk '{ if (match($0, /\[[^]]+\]/)) print substr($0, RSTART + 1, RLENGTH - 2) }' "$W/raw.txt" | sort -u > "$W/saa.txt"
: > "$W/map.txt"
while read -r t; do d="${t%%:*}"; r="${t#*:}"; e=$(date -d "$(echo "$d" | tr '/' ' ') ${r% *} ${r#* }" +%s 2>/dev/null) && printf '%s\t%s\n' "$t" "$e" >> "$W/map.txt"; done < "$W/saa.txt"
awk -F'\t' 'NR == FNR { m[$1] = $2; next } { if (match($0, /\[[^]]+\]/)) { t = substr($0, RSTART + 1, RLENGTH - 2); print (t in m ? m[t] : "-") "\t" $0 } }' "$W/map.txt" "$W/raw.txt" > "$W/e.txt"
BAD=$(awk -F'\t' '$1 == "-"' "$W/e.txt" | wc -l)
[ "$BAD" = 0 ] || { echo "SIYO: mistari $BAD ina saa isiyosomeka"; awk -F'\t' '$1 == "-" {print $2}' "$W/e.txt" | head -3 | cut -c1-200; exit 1; }

# IP halisi: sehemu ya mwisho yenye "..." ikiwa ni IP (X-Forwarded-For), vinginevyo $remote_addr
FMT='{ l = $0; sub(/^[^\t]*\t/, "", l); n = split(l, q, "\""); ip = l; sub(/ .*/, "", ip);
       x = (n >= 3 ? q[n - 1] : ""); if (x ~ /^[0-9a-fA-F.:]+(, *[0-9a-fA-F.:]+)*$/) { sub(/,.*/, "", x); ip = x }
       split(q[2], rq, " "); meth = rq[1]; p = rq[2]; sub(/\?.*/, "", p); st = q[3]; sub(/^ /, "", st); sub(/ .*/, "", st);
       ua = (n >= 7 ? q[6] : "") }'

echo "--- MAOMBI-YA-KUANDIKA-TANGU-DUMP ($(eat -d "@$DE" '+%H:%M:%S') EAT) ---"
awk -F'\t' -v de="$DE" -v uaipo="$UA_IPO" "$FMT"'
  $1 + 0 >= de + 0 && meth ~ /^(POST|PUT|PATCH|DELETE)$/ && p ~ /^\/api\// && p !~ /^\/api\/auth\/(login|refresh)$/ {
    if (uaipo == 1 && ua ~ /^lsms-18\//) { print "HATUA18\t" $1 "\t" ip "\t" meth " " p "\t" st; next }
    if (uaipo == 0 && p ~ /^\/api\/v1\/gl\/(corrections\/|journal-entries\/manual$|periods\/2026\/[0-9]+\/close$)/) { print "HATUA18?\t" $1 "\t" ip "\t" meth " " p "\t" st; next }
    print "KUANDIKA\t" $1 "\t" ip "\t" meth " " p "\t" st }' "$W/e.txt" > "$W/w.txt"
N=$(grep -c '^KUANDIKA' "$W/w.txt" || true)
H=$(grep -c '^HATUA18' "$W/w.txt" || true)
echo "maombi ya kuandika tangu dump: $N (ya hatua za 1.8 zenyewe, hayahesabiwi: $H)"
while IFS=$'\t' read -r k e ip mp st; do echo "  $k $(eat -d "@$e" '+%H:%M:%S') $ip $mp HTTP_$st"; done < <(head -n 40 "$W/w.txt")
[ "$(wc -l < "$W/w.txt")" -le 40 ] || echo "  ... (orodha imekatwa kwenye 40)"

echo "--- TAARIFA: MAOMBI YOTE TANGU FREEZE ($(eat -d "@$FZ" '+%H:%M') EAT) - si kinga ---"
echo "kwa METHOD:"
awk -F'\t' -v fz="$FZ" "$FMT"'$1 + 0 >= fz + 0 { print meth }' "$W/e.txt" | sort | uniq -c | sort -rn | sed 's/^/  /'
echo "kwa IP (maombi, ya mwisho EAT, METHOD):"
awk -F'\t' -v fz="$FZ" "$FMT"'$1 + 0 >= fz + 0 { c[ip]++; if ($1 > last[ip]) last[ip] = $1; m[ip, meth]++; ms[meth] = 1 }
  END { for (i in c) { s = ""; for (k in ms) if ((i, k) in m) s = s " " k "=" m[i, k]; print c[i] "\t" i "\t" last[i] "\t" s } }' "$W/e.txt" | sort -rn | head -n 15 \
  | while IFS=$'\t' read -r c ip e s; do echo "  $c $ip mwisho $(eat -d "@$e" '+%H:%M:%S')$s"; done
echo "kwa njia (METHOD njia, 15 za juu):"
awk -F'\t' -v fz="$FZ" "$FMT"'$1 + 0 >= fz + 0 { gsub(/\/[0-9a-fA-F-]{20,}/, "/UID", p); gsub(/\/[0-9]+(\/|$)/, "/N/", p); print meth " " p }' "$W/e.txt" | sort | uniq -c | sort -rn | head -n 15 | sed 's/^/  /'

echo NGINX_LOG_INAFANYA_KAZI
if [ "$N" = 0 ]; then echo MAANDISHI_TANGU_DUMP_HAKUNA; echo MAANDISHI_TANGU_FREEZE_HAKUNA; exit 0; fi
echo "SIYO: maombi $N ya kuandika baada ya dump mpya - dump haiwakilishi prod. SIMAMA: hakikisha hakuna kifaa kinachotumia LSMS (IP hapo juu), kisha anza 45a upya"
exit 1
MAANDISHI_EOF
# <<< nakala ya 45-maandishi.sh <<<
bash /tmp/45a-maandishi.sh "$T0" "$FZ"; MRC=$?
rm -f /tmp/45a-maandishi.sh
[ "$MRC" = 0 ] || fail 1

section "RAM-NA-DISK"
free -m | sed -n 1,2p; df -h / | tail -1
echo ---OK---
