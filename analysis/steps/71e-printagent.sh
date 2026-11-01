#!/usr/bin/env bash
# HATUA 71e (server) - A4 print-agent (mmiliki 29/10 aw). Hakuna restart; backend haiguswi.
#   soma          : KUSOMA TU (kikao read-only): akaunti imezimwa? kazi PRINTING (dryRun + nakala ya kila safu), role printer
#   badilisha <N> : print_jobs TU, transaction moja (/tmp/71e-badilisha.sql): PRINTING (kabla ya 01/07) -> FAILED, ikiwa
#                   akaunti imezimwa na idadi bado ni N ya dryRun; vinginevyo RAISE -> hakuna kilichobadilika
set -u -o pipefail
cd ~/lsms-deployment || { echo "SIYO: ~/lsms-deployment haipo"; exit 1; }
fail() { echo "SIYO: $*"; exit 1; }
PSQL='psql -X -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"'
case "${1:-}" in
soma)
  [ -s /tmp/71e-soma.sql ] || fail "/tmp/71e-soma.sql haipo"
  docker compose exec -T postgres sh -c "PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=60000' $PSQL" \
    < /tmp/71e-soma.sql 2>&1
  RC=$?; echo "[psql exit $RC]"; [ "$RC" = 0 ] || fail "psql ya kusoma imeshindwa"
  ;;
badilisha)
  N=${2:-}
  case "$N" in ''|*[!0-9]*) fail "idadi ya dryRun si namba ($N)";; esac
  [ -s /tmp/71e-badilisha.sql ] || fail "/tmp/71e-badilisha.sql haipo"
  docker compose exec -T postgres sh -c "PGOPTIONS='-c statement_timeout=60000' $PSQL -v idadi=$N" \
    < /tmp/71e-badilisha.sql 2>&1
  RC=$?; echo "[psql exit $RC]"; [ "$RC" = 0 ] || fail "badiliko halikufanyika (transaction imerudishwa)"
  ;;
*) fail "tumia: soma | badilisha <N>";;
esac
echo "---71e_SERVER_MWISHO---"
exit 0
