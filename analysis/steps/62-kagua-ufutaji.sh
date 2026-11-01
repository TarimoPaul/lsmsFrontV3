#!/usr/bin/env bash
# HATUA 62 (mmiliki 01/11 bk) - KUSOMA TU, PROD: sale 311026-2139 iliyofutwa, variance za reco za Oktoba,
#   gl_posting_failure tangu 31/10 18:00, depreciation ya 31/10. Hakuna restart, hakuna kuandika:
#   psql inaendeshwa kwa default_transaction_read_only=on na statement_timeout ya dakika 2.
set -u -o pipefail
cd ~/lsms-deployment || { echo "SIYO: ~/lsms-deployment haipo"; exit 1; }
[ -s /tmp/62-kagua-ufutaji.sql ] || { echo "SIYO: /tmp/62-kagua-ufutaji.sql haipo"; exit 1; }
CID=$(docker compose ps -q postgres < /dev/null | head -n1)
[ -n "$CID" ] || { echo "SIYO: container ya postgres haipo"; exit 1; }
echo "SAA_YA_SERVER $(TZ=Africa/Dar_es_Salaam date '+%F %H%M') EAT"
BID=$(docker compose ps -q backend < /dev/null | head -n1)
[ -n "$BID" ] && echo "BACKEND_IMAGE $(docker inspect --format '{{.Config.Image}}' "$BID" | sed 's/.*://')"
[ -n "$BID" ] && echo "BACKEND_TZ $(docker compose exec -T backend sh -c 'echo ${TZ:-HAIPO} $(date +%Z)' < /dev/null 2>/dev/null | tr -dc 'A-Za-z0-9_/ +-')"
docker compose exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120000" psql -X -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"' < /tmp/62-kagua-ufutaji.sql 2>&1
RC=$?
echo "[psql exit $RC]"
[ "$RC" = 0 ] || { echo "SIYO: psql ya kusoma imeshindwa"; exit 1; }
echo "---USHAHIDI_62_UMEKAMILIKA---"
exit 0
