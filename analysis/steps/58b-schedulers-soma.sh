#!/usr/bin/env bash
# HATUA 58b (mmiliki 28/10 aa) - KUSOMA TU, PROD: je, schedulers (CapitalExpenditureScheduler) zinaendeshwa?
#   Iendeshwe 29/10 BAADA ya 00:15 EAT. Hakuna restart, hakuna kuandika, config haibadilishwi.
#   1) container ya backend: ilipoanza; env; config iliyo NDANI ya jar (application*.properties, funguo mbili tu);
#   2) log ya backend tangu container ilipoanza: kila mstari wa [Scheduler] / ⏰ / CapitalExpenditureScheduler / depreciation /
#      recurring / LOAN_INTEREST_JOB, na saa zake;
#   3) hitimisho: SCHEDULERS_ZINAENDESHA (00:05 ya leo imeandika "Starting daily recurring expense processing")
#      au SCHEDULERS_HAZIENDESHI, au SCHEDULERS_HAIJULIKANI (container ilianza baada ya 00:05 ya leo);
#   4) SQL ya kusoma tu (/tmp/58b-schedulers-soma.sql): journal za SCHEDULER, templates, watoto, capex bila journal, depreciation.
set -u -o pipefail
cd ~/lsms-deployment || { echo "SIYO: ~/lsms-deployment haipo"; exit 1; }
[ -s /tmp/58b-schedulers-soma.sql ] || { echo "SIYO: /tmp/58b-schedulers-soma.sql haipo"; exit 1; }
CID=$(docker compose ps -q backend < /dev/null | head -n1)
[ -n "$CID" ] || { echo "SIYO: container ya backend haipo"; exit 1; }
STARTED=$(docker inspect --format '{{.State.StartedAt}}' "$CID")
echo "BACKEND_ILIANZA $STARTED"
echo "BACKEND_IMAGE $(docker inspect --format '{{.Config.Image}}' "$CID" | sed 's/.*://')"
LEO=$(TZ=Africa/Dar_es_Salaam date +%F)
SAA=$(TZ=Africa/Dar_es_Salaam date +%H%M)
echo "SAA_YA_SERVER $LEO $SAA EAT"

# Env (ishara, si mistari ya NAME=, ili ficha isizifiche)
SE=$(docker compose exec -T backend printenv APP_SCHEDULERS_ENABLED < /dev/null 2>/dev/null | tr -dc "a-zA-Z") || true
echo "SCHEDULERS_ENV ${SE:-HAIPO}"
SP=$(docker compose exec -T backend printenv SPRING_PROFILES_ACTIVE < /dev/null 2>/dev/null | tr -dc "a-zA-Z,") || true
echo "PROFILE_ENV ${SP:-HAIPO}"

# Config iliyojengwa ndani ya jar: funguo hizi mbili TU (faili lina siri nyingine - halichapishwi).
for f in application.properties application-pro.properties; do
  docker compose exec -T backend sh -c "unzip -p /app/app.jar BOOT-INF/classes/$f 2>/dev/null" < /dev/null \
    | tr -d '\r' | grep -E '^(app\.schedulers\.enabled|spring\.profiles\.group\.prod)=' \
    | sed "s/^/JAR_${f%%.properties} /; s/=/ /" || echo "JAR_${f%%.properties} HAKUNA_FUNGUO"
done

# Log tangu container ilipoanza: mistari ya schedulers tu.
LOGF=/tmp/58b-backend.log
# (ag) --timestamps: kila mstari unaanza na saa ya docker (UTC, RFC3339) - haitegemei TZ ya JVM.
docker compose logs --timestamps --no-log-prefix --no-color --since "$STARTED" backend < /dev/null > "$LOGF" 2>&1
echo "LOG_MISTARI_YOTE $(wc -l < "$LOGF")"
grep -E '\[Scheduler\]|CapitalExpenditureScheduler|[Dd]epreciation|[Rr]ecurring|LOAN_INTEREST_JOB|Due capex' "$LOGF" \
  | cut -c1-260 | sed 's/^/SCHED_LOG /' | tail -n 200
# (ag) Kiainishi: maandishi ya ASCII tu (si emoji), na tarehe ya EAT kutoka saa ya docker (UTC + 3h, EAT haina DST).
#   Kosa la awali: regex "^${LEO}T00:0[5-9]" - log ya app inaandika "2026-10-29 00:05:00" (nafasi, si T).
REC_TXT='[Scheduler] Starting daily recurring expense processing'
N_LEO=0
N_ZOTE=0
while IFS= read -r line; do
  TS=${line%% *}
  S=$(date -u -d "$TS" +%s 2>/dev/null) || continue
  EAT=$(date -u -d "@$((S + 10800))" '+%F %H:%M')
  echo "RECURRING_START_EAT $EAT"
  N_ZOTE=$((N_ZOTE + 1))
  [ "${EAT%% *}" = "$LEO" ] && N_LEO=$((N_LEO + 1))
done < <(grep -F -- "$REC_TXT" "$LOGF")
echo "RECURRING_START_LEO ${N_LEO:-0}"
echo "RECURRING_START_ZOTE ${N_ZOTE:-0}"
# EAT ni +03:00 daima (hakuna DST): linganisha sekunde, si maandishi ya saa za eneo.
STARTED_S=$(date -d "$STARTED" +%s 2>/dev/null || echo 0)
CUTOFF_S=$(date -d "${LEO} 00:05 +0300" +%s 2>/dev/null || echo 0)
if [ "${N_LEO:-0}" -ge 1 ]; then
  echo "SCHEDULERS_ZINAENDESHA"
elif [ "$STARTED_S" -gt "$CUTOFF_S" ] && [ "$CUTOFF_S" -gt 0 ]; then
  echo "SCHEDULERS_HAIJULIKANI container ilianza $STARTED, baada ya 00:05 ya leo (EAT)"
else
  echo "SCHEDULERS_HAZIENDESHI hakuna mstari wa 00:05 wa leo kwenye log ya container hii"
fi
rm -f "$LOGF"

docker compose exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120000" psql -X -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"' < /tmp/58b-schedulers-soma.sql 2>&1
RC=$?
echo "[psql exit $RC]"
[ "$RC" = 0 ] || { echo "SIYO: psql ya kusoma imeshindwa"; exit 1; }
echo "---USHAHIDI_58B_UMEKAMILIKA---"
exit 0
