#!/usr/bin/env bash
# HATUA 71f (server) - A4 ziada (mmiliki 29/10 ax): PRINT_JOB_MANAGE iondolewe kwenye role zote, role "printer" ifutwe.
#   Hakuna restart; backend inasoma ruhusa upya ndani ya dakika 15 (cache ya AuthTokenFilter) - hakuna anayezitumia leo.
#   soma          : KUSOMA TU (kikao read-only): nakala kamili ya role_permissions, dryRun, role zenye CREATE/MANAGE, masharti ya 71e
#   badilisha <N> : transaction moja (/tmp/71f-badilisha.sql); inakataa ikiwa masharti hayajatimia au idadi si N
set -u -o pipefail
cd ~/lsms-deployment || { echo "SIYO: ~/lsms-deployment haipo"; exit 1; }
fail() { echo "SIYO: $*"; exit 1; }
PSQL='psql -X -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"'
case "${1:-}" in
soma)
  [ -s /tmp/71f-soma.sql ] || fail "/tmp/71f-soma.sql haipo"
  docker compose exec -T postgres sh -c "PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=60000' $PSQL" \
    < /tmp/71f-soma.sql 2>&1
  RC=$?; echo "[psql exit $RC]"; [ "$RC" = 0 ] || fail "psql ya kusoma imeshindwa"
  ;;
badilisha)
  N=${2:-}
  case "$N" in ''|*[!0-9]*) fail "idadi ya dryRun si namba ($N)";; esac
  [ -s /tmp/71f-badilisha.sql ] || fail "/tmp/71f-badilisha.sql haipo"
  docker compose exec -T postgres sh -c "PGOPTIONS='-c statement_timeout=60000' $PSQL -v idadi=$N" \
    < /tmp/71f-badilisha.sql 2>&1
  RC=$?; echo "[psql exit $RC]"; [ "$RC" = 0 ] || fail "badiliko halikufanyika (transaction imerudishwa)"
  ;;
*) fail "tumia: soma | badilisha <N>";;
esac
echo "---71f_SERVER_MWISHO---"
exit 0
