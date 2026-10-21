#!/usr/bin/env bash
# HATUA 36-1 - inaendeshwa KWENYE CONTABO na 36-1-staging-washa.cmd (scp kwenda /tmp, kisha bash; output -> ficha.awk).
# Inawasha STAGING (~/lsms-staging, project lsms-staging) iliyosimamishwa na mmiliki. HAIBADILISHI image wala tag:
#   - .env lazima iwe BACKEND_VERSION=2.2.70 (haiguswi);
#   - kila image ya compose ya staging lazima iwe tayari kwenye server; `up -d --pull never` (hakuna pull).
# PROD (~/lsms-deployment) inasomwa tu (ps kabla na baada; lazima iwe sawa).
# Mwisho: ---OK--- au ---IMESHINDWA-KWENYE: <sehemu> (exit N)---.
set -u -o pipefail
STEP=""
fail() { local rc=${1:-1}; echo "---IMESHINDWA-KWENYE: $STEP (exit $rc)---"; exit 1; }
section() { STEP="$1"; echo "---$1---"; }
prodps() { (cd ~/lsms-deployment && docker compose ps --format '{{.Service}} {{.Image}} {{.State}}' | sort); }

section "RAM-NA-DISK-KABLA"
free -m; df -h / | tail -1
RAM_KABLA=$(free -m | awk '/^Mem:/{print $7}')
echo "RAM_INAYOPATIKANA_KABLA_MB=$RAM_KABLA"

section "PROD-PS-KABLA"
P_KABLA=$(prodps) || fail $?
echo "$P_KABLA"

cd ~/lsms-staging || { STEP="CD-LSMS-STAGING"; fail 1; }

section "STAGING-HALI-KABLA"
docker compose -p lsms-staging ps -a --format 'table {{.Service}} {{.Image}} {{.Status}}' || fail $?

section "TOLEO-LAZIMA-2.2.70"
grep -Fx 'BACKEND_VERSION=2.2.70' .env || fail 1

section "IMAGES-LAZIMA-ZIWE-KWENYE-SERVER (hakuna pull)"
IMAGES=$(docker compose -p lsms-staging config --images) || fail $?
MISSING=0
for img in $IMAGES; do
  if docker image inspect "$img" >/dev/null 2>&1; then echo "ipo: $img"; else echo "HAIPO: $img"; MISSING=$((MISSING + 1)); fi
done
[ "$MISSING" = "0" ] || fail 1
echo "$IMAGES" | grep -q 'my-lsms-backend:2.2.70$' || { echo "backend ya compose si my-lsms-backend:2.2.70"; fail 1; }

section "WASHA (up -d --pull never)"
START=$(date -u +%Y-%m-%dT%H:%M:%SZ)  # log za backend zinasomwa tangu sasa tu (si za startup ya zamani)
docker compose -p lsms-staging up -d --pull never 2>&1 || fail $?

section "SUBIRI-POSTGRES-HEALTHY (hadi sek 180)"
PG=$(docker compose -p lsms-staging ps -q postgres) || fail $?
[ -n "$PG" ] || fail 1
H=""
for i in $(seq 1 90); do
  H=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$PG")
  [ "$H" = "healthy" ] && break
  sleep 2
done
echo "postgres: $H (baada ya sek $((i * 2)))"
[ "$H" = "healthy" ] || fail 1

section "SUBIRI-BACKEND-IJIBU (hadi sek 300; POST /api/auth/login tupu lazima 400)"
CODE=""
for i in $(seq 1 100); do
  CODE=$(curl -s -o /dev/null -m 5 -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/api/auth/login | tr -dc '0-9' || true)  # tarakimu tu: bila \r wala nafasi
  [ "$CODE" = "400" ] && break
  if docker compose -p lsms-staging logs --no-color --since "$START" backend 2>&1 | grep -qE 'APPLICATION FAILED|Application run failed'; then break; fi
  sleep 3
done
echo "backend kupitia nginx ya staging: HTTP $CODE (baada ya sek $((i * 3)))"
docker compose -p lsms-staging logs --no-color --since "$START" backend 2>&1 | grep -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed' | tail -2
[ "$CODE" = "400" ] || fail 1

section "TOLEO-NA-FLYWAY (lazima 2.2.70 / 133)"
RUN_IMG=$(docker compose -p lsms-staging ps --format '{{.Image}}' backend) || fail $?
echo "backend inayoendesha: $RUN_IMG"
FW=$(docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1 \
     -c "SET default_transaction_read_only = on" \
     -c "SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1") || fail $?
FW=$(echo "$FW" | tail -1)
echo "flyway ya mwisho: $FW"
case "$RUN_IMG" in *:2.2.70) ;; *) echo "backend si 2.2.70"; fail 1;; esac
[ "$FW" = "133" ] || { echo "flyway si 133"; fail 1; }

section "STAGING-PS-BAADA"
docker compose -p lsms-staging ps --format 'table {{.Service}} {{.Image}} {{.Status}}'

section "RAM-NA-DISK-BAADA"
free -m; df -h / | tail -1
RAM_BAADA=$(free -m | awk '/^Mem:/{print $7}')
echo "RAM_INAYOPATIKANA_BAADA_MB=$RAM_BAADA (staging inatumia takriban $((RAM_KABLA - RAM_BAADA)) MB)"

section "PROD-PS-BAADA (lazima iwe sawa na kabla)"
P_BAADA=$(prodps) || fail $?
echo "$P_BAADA"
[ "$P_KABLA" = "$P_BAADA" ] || { echo "PROD IMEBADILIKA kati ya kabla na baada"; fail 1; }
echo "prod: sawa (services, images na hali hazijabadilika)"

echo ---OK---
