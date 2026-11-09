#!/usr/bin/env bash
# HATUA 75 (mmiliki 09/11 cz/da), Contabo, KUSOMA TU. Hakuna kinachobadilika.
# Inaleta hali ya server inayohitajika kuandika script ya deploy 2.4.0+3.2.0 (staging = prod):
#   majina ya funguo za .env (BILA thamani), nani anatumia ADMIN_PASSWORD/DOCKERHUB_PASSWORD kwenye compose,
#   container zinazoendesha, Flyway ya mwisho, image zilizopo, diski/RAM, backup za mwisho, docker login (jina la registry tu).
# Output yote inapita ficha.awk kabla ya kutoka server.
set -u
for d in lsms-deployment lsms-staging; do
  D=/home/chief/$d
  echo "=== $d"
  [ -d "$D" ] || { echo "HAIPO $D"; continue; }
  cd "$D" || continue
  echo "--- ENV_FUNGUO (majina tu)"
  sed -n 's/^[[:space:]]*\(export[[:space:]]\+\)\?\([A-Za-z0-9_]\+\)=.*/\2/p' .env | tr '\n' ' '; echo
  echo "--- ENV_VERSION"
  grep -E '^(BACKEND_VERSION|FRONTEND_V3_VERSION|FRONTEND_VERSION|SCHEDULERS?_[A-Z_]*|APP_SCHEDULERS[A-Z_]*|DAILY_SALES_PROFIT_ROLES)=' .env
  echo "--- COMPOSE_FAILI"
  ls -1 docker-compose*.y*ml compose*.y*ml 2>/dev/null
  echo "--- COMPOSE_VARS (\${...} zinazotumika)"
  cat docker-compose*.y*ml compose*.y*ml 2>/dev/null | grep -o '\${[A-Za-z0-9_]*' | sort -u | tr -d '${' | tr '\n' ' '; echo
  echo "--- ADMIN/DOCKERHUB kwenye compose/scripts (mstari na faili tu)"
  grep -n -E 'ADMIN_PASSWORD|DOCKERHUB' docker-compose*.y*ml compose*.y*ml *.sh 2>/dev/null | cut -d: -f1,2
  grep -l -E 'ADMIN_PASSWORD|DOCKERHUB' /home/chief/*.sh 2>/dev/null
  echo "--- PS"
  docker compose ps --format '{{.Service}} {{.Image}} {{.Status}}' < /dev/null 2>&1
  echo "--- ENV_ZA_CONTAINER_YA_BACKEND (majina tu)"
  cid=$(docker compose ps -q backend < /dev/null 2>/dev/null | head -n1)
  [ -n "$cid" ] && docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$cid" | sed 's/=.*//' | tr '\n' ' '; echo
  echo "--- FLYWAY (5 za mwisho)"
  docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "select installed_rank, version, success, installed_on::date from flyway_schema_history order by installed_rank desc limit 5"' < /dev/null 2>&1
  echo "--- PREV_FILES"
  for f in .backend.prev .frontend-v3.prev; do [ -f "$f" ] && echo "$f $(cat "$f")"; done
  echo "--- ENV_BACKUPS"
  ls -1t .env.bak* 2>/dev/null | head -5
done
echo "=== IMAGE"
docker images --format '{{.Repository}}:{{.Tag}} {{.CreatedSince}} {{.Size}}' | grep -E 'chiefmaster/' | sort
echo "=== DISK_RAM"
df -h / | tail -1
free -m | sed -n 2,3p
echo "=== BACKUP"
ls -1t /home/chief/backups/daily/ 2>/dev/null | head -3
for f in $(ls -1t /home/chief/backups/daily/lsms_*.dump 2>/dev/null | head -2); do echo "$f $(stat -c %s "$f")"; done
[ -x /home/chief/backup-lsms.sh ] && echo "backup-lsms.sh IPO" || echo "backup-lsms.sh HAIPO"
grep -n -E 'rclone|pg_dump|sha256' /home/chief/backup-lsms.sh 2>/dev/null | cut -c1-160
echo "=== DOCKER_LOGIN (registry tu)"
if [ -f /home/chief/.docker/config.json ]; then
  grep -o '"https\?://[^"]*"' /home/chief/.docker/config.json | sort -u
  grep -o '"credsStore"[^,}]*' /home/chief/.docker/config.json
else echo "config.json HAIPO"; fi
echo "=== CRON (backup/docker)"
crontab -l 2>/dev/null | grep -v '^#' | grep -E 'backup|docker|lsms' | cut -c1-160
echo "---75_SERVER_MWISHO---"
