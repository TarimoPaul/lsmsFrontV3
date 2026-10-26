#!/usr/bin/env bash
# HATUA 58 (mmiliki 26/10) - KUSOMA TU: mikopo A na B kwenye DB ya prod (rekodi za capital_injections, kila journal na mistari yake,
#   salio la 1000/1021/1200/2100/6600) kwa MUUNDO wa 2.3.0 hatua 0, na D2 (backup_20260930_journal_entry: inategemewa na nini?).
# Inaendeshwa kwenye Contabo na 58-prod-mikopo-soma.cmd (scp -> /tmp; output -> ficha.awk). psql: PGOPTIONS read only +
#   BEGIN READ ONLY ... ROLLBACK ndani ya SQL. Hakuna restart, hakuna kuandika.
set -u -o pipefail
cd ~/lsms-deployment || exit 1
[ -s /tmp/58-mikopo-soma.sql ] || { echo "SIYO: /tmp/58-mikopo-soma.sql haipo"; exit 1; }
docker compose exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120000" psql -X -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"' < /tmp/58-mikopo-soma.sql 2>&1
RC=$?
echo "[psql exit $RC]"
[ "$RC" = 0 ] || { echo "SIYO: psql ya kusoma imeshindwa"; exit 1; }
echo "---USHAHIDI_58_UMEKAMILIKA---"
exit 0
