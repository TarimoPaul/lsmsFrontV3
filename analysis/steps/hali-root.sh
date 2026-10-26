#!/usr/bin/env bash
# hali-root.sh <prod|staging> <KABLA|BAADA|SASA> - KUSOMA TU (mmiliki 22/10, hotfix 2.2.72 (e)):
#   hali ya admin@admin.com na root@system.com KABLA na BAADA ya kila restart ya backend ya staging au prod.
#   Inaendeshwa kwenye Contabo (scp -> /tmp, output -> ficha.awk) na kila hatua inayofanya restart:
#     bash /tmp/hali-root.sh prod KABLA   ... restart ...   bash /tmp/hali-root.sh prod BAADA
#   KABLA inahifadhi hali kwenye /tmp/hali-root-<lengo>.kabla; BAADA inailinganisha na kuandika ishara moja:
#     HALI_ROOT_SAWA          - hakuna safu iliyobadilika
#     HALI_ROOT_IMEBADILIKA   - kitu kimebadilika (mistari ya KABLA na BAADA inaonyeshwa) -> hatua isimame, mmiliki aambiwe
#     HALI_ROOT_HAKUNA_KABLA  - BAADA bila KABLA
#   psql iko ndani ya transaction ya READ ONLY (default_transaction_read_only=on); hakuna safu ya siri (password/token).
set -u -o pipefail
LENGO=${1:-}
LEBO=${2:-}
case "$LENGO" in
  prod) cd ~/lsms-deployment || exit 1; DC() { docker compose "$@"; } ;;
  staging) cd ~/lsms-staging || exit 1; DC() { docker compose -p lsms-staging "$@"; } ;;
  *) echo "HALI_ROOT_KOSA lengo lazima liwe prod au staging"; exit 2 ;;
esac
case "$LEBO" in KABLA|BAADA|SASA) ;; *) echo "HALI_ROOT_KOSA lebo lazima iwe KABLA, BAADA au SASA"; exit 2 ;; esac

HALI=$(DC exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=30000" psql -X -q -v ON_ERROR_STOP=1 -At -F"|" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"' <<'SQL'
SELECT e.email || '|' || coalesce(u.id::text, 'HAIPO') || '|' || coalesce(u.status, '-') || '|is_root ' || coalesce(u.is_root::text, '-')
       || '|is_locked ' || coalesce(u.is_locked::text, '-') || '|is_deleted ' || coalesce(u.is_deleted::text, '-')
       || '|email_verified ' || coalesce(u.email_verified::text, '-') || '|updated_at ' || coalesce(u.updated_at::text, '-')
       || '|last_login_at ' || coalesce(u.last_login_at::text, '-')
  FROM (VALUES ('admin@admin.com'), ('root@system.com')) AS e(email)
  LEFT JOIN users u ON u.email = e.email
 ORDER BY e.email;
SELECT 'is_root_wote ' || count(*) || ' ' || coalesce(string_agg(email, ',' ORDER BY email), '-') FROM users WHERE is_root;
SELECT 'users_wote ' || count(*) FROM users;
SQL
)
RC=$?
if [ $RC -ne 0 ]; then echo "HALI_ROOT_KOSA psql exit $RC"; exit $RC; fi
echo "HALI_ROOT_SAA|$LEBO|$LENGO|$(date '+%Y-%m-%d %H:%M:%S %Z')"
printf '%s\n' "$HALI" | sed "s/^/HALI_ROOT|$LEBO|$LENGO|/"

F=/tmp/hali-root-$LENGO.kabla
case "$LEBO" in
  KABLA) printf '%s\n' "$HALI" > "$F" ;;
  BAADA)
    if [ ! -f "$F" ]; then echo "HALI_ROOT_HAKUNA_KABLA"; exit 0; fi
    # last_login_at haihesabiwi: login za ukaguzi za hatua yenyewe zisilete kengele ya uongo.
    if [ "x$(sed 's/|last_login_at .*//' "$F")" = "x$(printf '%s\n' "$HALI" | sed 's/|last_login_at .*//')" ]; then
      echo "HALI_ROOT_SAWA"
    else
      echo "HALI_ROOT_IMEBADILIKA"
      sed 's/^/  KABLA|/' "$F"
      printf '%s\n' "$HALI" | sed 's/^/  BAADA|/'
    fi
    rm -f "$F" ;;
esac
exit 0
