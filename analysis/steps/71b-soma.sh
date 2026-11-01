#!/usr/bin/env bash
# HATUA 71b (server) - KUSOMA TU (mmiliki 29/10 as.0b, as.0e). Hakuna restart, hakuna kuandika (DB wala B2).
#   1) B2: lifecycleRules za bucket elikom-lsms-backups kupitia API ya B2 (b2_authorize_account + b2_list_buckets), kwa
#      sababu rclone ya server haina "backend lifecycle". Funguo zinasomwa kutoka rclone config (remote b2) na HAZICHAPISHWI.
#      Hitimisho: B2_LIFECYCLE_SALAMA / B2_LIFECYCLE_HATARI (kanuni inayoficha faili za archive/ baada ya siku N) /
#      B2_LIFECYCLE_HAIJULIKANI.
#   2) PROD: akaunti ya print-agent kwenye users + print_jobs (/tmp/71b-printagent.sql), kikao read-only kama 58b.
set -u -o pipefail
fail() { echo "SIYO: $*"; exit 1; }
[ -s /tmp/71b-printagent.sql ] || fail "/tmp/71b-printagent.sql haipo"

echo "---B2-LIFECYCLE---"
CS=$(rclone config show b2 2>/dev/null)
ACC=$(printf '%s\n' "$CS" | sed -n 's/^account *= *//p' | head -n1)
KEY=$(printf '%s\n' "$CS" | sed -n 's/^key *= *//p' | head -n1)
unset CS
[ -n "$ACC" ] || ACC=${RCLONE_CONFIG_B2_ACCOUNT:-}
[ -n "$KEY" ] || KEY=${RCLONE_CONFIG_B2_KEY:-}
LC=HAIJULIKANI
if [ -z "$ACC" ] || [ -z "$KEY" ]; then
  echo "rclone config ya remote b2 haina account/key zinazosomeka (huenda config imesimbwa)"
else
  AUTH=$(curl -sS --max-time 30 -u "$ACC:$KEY" https://api.backblazeb2.com/b2api/v2/b2_authorize_account 2>&1)
  unset KEY
  J() { printf '%s' "$AUTH" | tr -d '\n' | grep -o "\"$1\": *\"[^\"]*\"" | head -n1 | sed 's/.*: *"//; s/"$//'; }
  API=$(J apiUrl); TOK=$(J authorizationToken); AID=$(J accountId)
  if [ -z "$TOK" ]; then
    echo "b2_authorize_account imeshindwa: $(J code) $(J message)"
  else
    echo "b2_authorize_account sawa"
    LB=$(curl -sS --max-time 30 -H "Authorization: $TOK" \
         -d "{\"accountId\":\"$AID\",\"bucketName\":\"elikom-lsms-backups\"}" "$API/b2api/v2/b2_list_buckets" 2>&1)
    unset TOK AUTH
    FL=$(printf '%s' "$LB" | tr -d '\n\r')
    if ! printf '%s' "$FL" | grep -q '"bucketName": *"elikom-lsms-backups"'; then
      echo "b2_list_buckets haikurudisha bucket: $(printf '%s' "$FL" | grep -o '"\(code\|message\)": *"[^"]*"' | tr '\n' ' ')"
    else
      echo "bucketType $(printf '%s' "$FL" | grep -o '"bucketType": *"[^"]*"' | sed 's/.*: *"//; s/"$//')"
      RULES=$(printf '%s' "$FL" | grep -o '"lifecycleRules": *\[[^]]*\]')
      echo "LIFECYCLE_RULES ${RULES:-hakuna-sehemu-ya-lifecycleRules}"
      N=0; H=0; T="archive/2026-10/analysis-archive-2026-10.zip"
      for R in $(printf '%s' "$RULES" | grep -o '{[^{}]*}' | tr -d ' '); do
        N=$((N+1))
        P=$(printf '%s' "$R" | grep -o '"fileNamePrefix":"[^"]*"' | sed 's/.*:"//; s/"$//')
        D=$(printf '%s' "$R" | grep -o '"daysFromUploadingToHiding":[0-9]*' | sed 's/.*://')
        X=$(printf '%s' "$R" | grep -o '"daysFromHidingToDeleting":[0-9]*' | sed 's/.*://')
        case "$T" in "$P"*) M=inahusu_archive;; *) M=haihusu_archive;; esac
        echo "KANUNI_$N prefix [$P] kuficha_baada_ya ${D:-null} kufuta_iliyofichwa_baada_ya ${X:-null} $M"
        [ "$M" = inahusu_archive ] && [ -n "$D" ] && H=$((H+1))
      done
      if [ "x$H" = "x0" ]; then LC=SALAMA; else LC=HATARI; fi
    fi
  fi
fi
unset ACC KEY TOK AUTH
echo "B2_LIFECYCLE_$LC"
echo "---B2-ARCHIVE-ILIYOPO---"
rclone lsl b2:elikom-lsms-backups/archive 2>&1 | cut -c1-200

echo "---PROD-PRINT-AGENT (read-only)---"
cd ~/lsms-deployment || fail "~/lsms-deployment haipo"
docker compose exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=60000" psql -X -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"' < /tmp/71b-printagent.sql 2>&1
RC=$?
echo "[psql exit $RC]"
[ "$RC" = 0 ] || fail "psql ya kusoma imeshindwa"
echo "---71b_SERVER_MWISHO---"
exit 0
