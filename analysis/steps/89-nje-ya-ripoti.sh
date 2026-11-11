#!/usr/bin/env bash
# HATUA 89 (mmiliki 11/11 ew/ex) - PROD, BAADA ya toleo 2 (V145 + /ops-report-exclusion): weka alama "nje ya ripoti ya
# uendeshaji" kwa rows ambazo GL yake imeshashughulikiwa na hatua 80, ili ripoti ya Nov isionyeshe Frame/TRA mara mbili:
#   REN-MON-20261101-000000-5D9DD844  Frame Nov 200,000  (share ya mwaka F7C9E331 tayari ipo kila mwezi)
#   TAX-MON-20261101-000000-B4F8EA66  TRA Nov 250,000    (share ya mwaka 4B42C8F1 tayari ipo kila mwezi)
#   (L89_ZAIDI="REF1 REF2" ikiwa Chief ataongeza nyingine, mf. 2939F6DE baada ya jibu la hatua 88)
# Row na journal HAZIGUSWI (GL ya 80 inabaki). Sababu: "zimeshughulikiwa na hatua 80".
#   bash 89-nje-ya-ripoti.sh kagua    KUSOMA TU: kila row (ipo? alama? journal), V145 ipo?, TB
#   bash 89-nje-ya-ripoti.sh andika   stdin = email, password ya mwenye CAPITAL_APPROVE -> API kwa kila row
# Kinga: V145 lazima iwe imefanyika; kila ref lazima iwe row MOJA ya MONTHLY_EXPENSE; iliyowekwa alama tayari inarukwa;
#   GL (TB, 1000, 6000, 6800) haibadiliki - ikibadilika -> IMESHINDWA. ASCII tu.
set -uo pipefail
MODE="${1:-}"
H="${L89_HOME:-$HOME}"
DIR="${L89_DIR:-$H/lsms-deployment}"; PROJ="${L89_PROJ:-lsms-deployment}"; BASE="${L89_BASE:-http://localhost}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---89_IMESHINDWA---"; exit 1; }
REFS="REN-MON-20261101-000000-5D9DD844 TAX-MON-20261101-000000-B4F8EA66 ${L89_ZAIDI:-}"
WHY="zimeshughulikiwa na hatua 80"
tb() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
dc() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
   where l.account_code='$1' and e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
gl() { echo "TB $(tb) | 1000 $(dc 1000) | 6000 $(dc 6000) | 6800 $(dc 6800) | 6200 $(dc 6200)"; }
v145() { q "select count(*) from flyway_schema_history where version = '145' and success"; }
row() { q "select count(*)||' | '||coalesce(max(expenditure_type::text),'-')||' | '||coalesce(bool_or(exclude_from_ops_report)::text,'-')||' | '||coalesce(max(uid),'-')
   from capital_expenditure where reference_number = '$1' and not coalesce(is_deleted,false)"; }

if [ "$MODE" = kagua ]; then
  echo "=== 89 KAGUA $(date '+%F %T') - KUSOMA TU"
  echo "V145 (exclude_from_ops_report): $(v145)   (lazima 1; 0 = toleo 2 bado halijafika prod -> USIENDESHE ANDIKA)"
  [ "$(v145)" = 1 ] || { echo "---89_KAGUA_MWISHO---"; exit 0; }
  echo "--- ref | maelezo | kiasi | aina | tayari nje? | journal"
  for r in $REFS; do
    q "select c.reference_number, c.description, c.amount::numeric(19,0), c.expenditure_type, c.exclude_from_ops_report,
              coalesce((select string_agg(e.entry_date||' '||e.status||' ['||(select string_agg(l.account_code||':'||(l.debit_amount-l.credit_amount)::numeric(19,0), ',' order by l.account_code) from journal_entry_line l where l.journal_entry_uid=e.uid)||']', ' ; ') from journal_entry e where e.reference_uid=c.uid and not coalesce(e.is_deleted,false)),'HAKUNA JOURNAL')
       from capital_expenditure c where c.reference_number = '$r' and not coalesce(c.is_deleted,false)" | grep . || echo "$r | HAIPO"
  done
  echo "--- zilizo nje ya ripoti sasa:"; q "select reference_number, amount::numeric(19,0) from capital_expenditure where exclude_from_ops_report order by 1"
  echo "--- GL sasa: $(gl)"
  echo "ANDIKA itaweka alama kwa: $REFS - sababu '$WHY'. GL haibadiliki."
  echo "---89_KAGUA_MWISHO---"; exit 0
fi
[ "$MODE" = andika ] || { echo "MATUMIZI: $0 kagua | andika"; exit 2; }
IFS= read -r EMAIL || true; IFS= read -r PASS || true; EMAIL=${EMAIL%$'\r'}; PASS=${PASS%$'\r'}
[ -n "$EMAIL" ] && [ -n "$PASS" ] || die "email/password tupu"
echo "=== 89 ANDIKA $(date '+%F %T')"
[ "$(v145)" = 1 ] || die "V145 haipo - toleo 2 bado halijafika prod"
TODO=""
for r in $REFS; do
  x=$(row "$r")
  case "$x" in
    "1 | MONTHLY_EXPENSE | false | "*) TODO="$TODO ${x##* | }:$r" ;;
    "1 | MONTHLY_EXPENSE | true | "*) echo "$r tayari iko nje ya ripoti - inarukwa" ;;
    *) die "$r: $x (lazima row MOJA ya MONTHLY_EXPENSE) - HAKUNA kilichoandikwa" ;;
  esac
done
[ -n "$TODO" ] || { echo "hakuna cha kuweka alama"; echo "---89_MWISHO---"; exit 0; }
G0=$(gl); echo "--- GL KABLA: $G0"
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
api() { HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X POST -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' ${TOKEN:+-H "Authorization: Bearer $TOKEN"} --data "$2" "$BASE$1"); }
okb() { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg() { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 300; }
TOKEN=; api /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"; PASS=
TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); [ -n "$TOKEN" ] || die "login HTTP $HC $(msg)"; echo "login SAWA"
for t in $TODO; do
  uid=${t%%:*}; r=${t#*:}
  api "/api/v1/capital-expenditure/$uid/ops-report-exclusion" "{\"exclude\":true,\"reason\":\"$WHY\"}"
  okb || die "$r: HTTP $HC $(msg) (zilizotangulia kwenye orodha hii zimeshawekwa alama; endesha KAGUA)"
  echo "$r: SAWA - $(msg)"
done
q "select x.at::timestamp(0), c.reference_number, x.action, x.reason, x.by_name from capex_ops_report_exclusion_log x join capital_expenditure c on c.uid=x.capex_uid order by x.id desc limit 10"
G1=$(gl); echo "--- GL BAADA: $G1"
[ "$G1" = "$G0" ] || die "GL imebadilika ($G0 -> $G1)"
echo "---89_MWISHO---"
