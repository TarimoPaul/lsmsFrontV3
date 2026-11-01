#!/usr/bin/env bash
# HATUA 60 (mmiliki 28/10 x, S-A) - server: gl_config.bank_cutover_date = D. IMEANDALIWA TU (haijaendeshwa).
#   bash /tmp/60-bank-cutover.sh <prod|staging> <YYYY-MM-DD>
# SQL: /tmp/60-bank-cutover.sql (kinga zote ziko ndani yake, transaction moja). Matokeo ni ishara (si mistari ya NAME=).
set -u -o pipefail
T="${1:-}"; D="${2:-}"
case "$T" in
  prod)    DIR=~/lsms-deployment; P="" ;;
  staging) DIR=~/lsms-staging;    P="-p lsms-staging" ;;
  *) echo "SIYO: lengo lazima liwe prod au staging (ni [$T])"; exit 1 ;;
esac
[[ "$D" =~ ^20[0-9]{2}-[01][0-9]-[0-3][0-9]$ ]] || { echo "SIYO: D si tarehe YYYY-MM-DD (ni [$D])"; exit 1; }
date -d "$D" +%F > /dev/null 2>&1 || { echo "SIYO: D si tarehe halali ($D)"; exit 1; }
[ -s /tmp/60-bank-cutover.sql ] || { echo "SIYO: /tmp/60-bank-cutover.sql haipo"; exit 1; }
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
echo "LENGO $T D $D"
docker compose $P exec -T -e "D=$D" postgres sh -c 'psql -X -q -At -v ON_ERROR_STOP=1 -v D="$D" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"' \
  < /tmp/60-bank-cutover.sql 2>&1
RC=$?
echo "[psql exit $RC]"
[ "$RC" = 0 ] || { echo "SIYO: hakuna kilichobadilika (ROLLBACK)"; exit 1; }
echo "---60_MWISHO---"
exit 0
