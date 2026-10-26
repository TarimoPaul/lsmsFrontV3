#!/usr/bin/env bash
# HATUA 54 (mmiliki 22/10) - KUSOMA TU: marejeo YOTE (si audit tu) ya admin@admin.com - users.id=9 / uid 5e0e9b5c... / email -
#   kwenye DB ya prod, idadi kwa kila jedwali, KABLA ya uamuzi wa kufuta au tombstone (52c).
# Inaendeshwa kwenye Contabo na 54-prod-admin-marejeo.cmd (scp -> /tmp; output -> ficha.awk). Hakuna restart, hakuna kuandika:
#   psql iko ndani ya transaction ya READ ONLY (PGOPTIONS default_transaction_read_only=on, na BEGIN READ ONLY ... ROLLBACK
#   ndani ya SQL), statement_timeout 120s - ufikiaji uleule wa kusoma tu ambao mmiliki aliuruhusu wazi kwa 53.
#  1) hali ya sasa ya admin@admin.com na root@system.com (hali-root.sh prod SASA)
#  2) SQL ya 52b (52b-admin-marejeo.sql): FK zote kwenda users (hata 0), safu za maandishi/uuid/json (kamili na ndani ya
#     maandishi), safu za namba zenye jina la mtumiaji = 9, jina 'System Root' (taarifa tu), JEDWALI|jina|idadi, UAMUZI.
set -u -o pipefail
cd ~/lsms-deployment || exit 1
PSQL() { docker compose exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120000" psql -X -q -v ON_ERROR_STOP=1 -At -F"|" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"'; }

echo "---1-HALI-YA-ROOT-SASA---"
bash /tmp/hali-root.sh prod SASA || { echo "SIYO: hali-root.sh imeshindwa"; exit 1; }

echo "---2-MAREJEO-YA-ADMIN-KUSOMA-TU---"
PSQL < /tmp/54-admin-marejeo.sql 2>&1 | sed -E 's/^psql:[^:]*:[0-9]+: NOTICE: +//; s/ = / idadi /' || { echo "SIYO: psql ya kusoma imeshindwa"; exit 1; }
echo "---USHAHIDI_54_UMEKAMILIKA---"
exit 0
