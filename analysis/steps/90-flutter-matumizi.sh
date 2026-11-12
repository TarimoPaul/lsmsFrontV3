#!/usr/bin/env bash
# HATUA 90 (mmiliki 11/11 fa 9) - PROD, KUSOMA TU: je, Flutter bado inatumika? (kabla ya ORODHA-FLUTTER-V3 / C7)
#   login_audit (V137): logins za siku 30 kwa aina ya mteja (Dart = Flutter, Mozilla = kivinjari/V3), na watumiaji wa Flutter.
#   audit_trails: matukio ya siku 30 kwa user agent (Dart vs kivinjari) na moduli.
#   bash 90-flutter-matumizi.sh kagua
# Hakuna kinachoandikwa. ASCII tu.
set -uo pipefail
MODE="${1:-}"
H="${L90_HOME:-$HOME}"
DIR="${L90_DIR:-$H/lsms-deployment}"; PROJ="${L90_PROJ:-lsms-deployment}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
[ "$MODE" = kagua ] || { echo "MATUMIZI: $0 kagua"; exit 2; }
UA="case when user_agent ilike '%dart%' then 'FLUTTER' when user_agent ilike '%mozilla%' then 'KIVINJARI' else 'NYINGINE' end"
echo "=== 90 KAGUA $(date '+%F %T') - KUSOMA TU"
if [ "$(q "select count(*) from information_schema.tables where table_name='login_audit'")" = 1 ]; then
  echo "--- logins siku 30: mteja | idadi | watumiaji | ya mwisho"
  q "select $UA, count(*), count(distinct coalesce(user_uid, email_attempted)), max(at)::timestamp(0) from login_audit where at > now() - interval '30 days' group by 1 order by 2 desc"
  echo "--- watumiaji wa FLUTTER siku 30: email | logins | ya mwisho"
  q "select coalesce(email_attempted,'-'), count(*), max(at)::timestamp(0) from login_audit where at > now() - interval '30 days' and user_agent ilike '%dart%' group by 1 order by 2 desc"
else
  echo "login_audit haipo (V137 haijafika prod) - tazama audit_trails tu"
fi
echo "--- audit_trails siku 30: mteja | moduli | idadi"
q "select $UA, coalesce(module,'-'), count(*) from audit_trails where \"timestamp\" > now() - interval '30 days' group by 1,2 order by 1, 3 desc limit 60"
echo "---90_KAGUA_MWISHO---"
