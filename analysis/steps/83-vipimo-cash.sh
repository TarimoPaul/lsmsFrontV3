#!/usr/bin/env bash
# HATUA 83 (mmiliki 10/11 eh) - PROD: marekebisho ya cash. Manunuzi 9 ya vipimo (20/02-17/08, 159,000) yaliandikwa
# Dr 1200 / Cr 1000 lakini HAYAKULIPWA (Chief 10/11): Dr 1000 159,000 / Cr 3900 159,000, tarehe = siku ya kuandika.
# Uchambuzi: analysis/toleo2/KUPIMA-GL-EG.md (Dr 1200 ya uongo ilienda COGS za vipindi vilivyofungwa + true-up 30/09 -> 3900).
#   bash 83-vipimo-cash.sh kagua      KUSOMA TU: journal 9 za manunuzi, salio 1000/3900, TB, cutover, kipindi, journal ya 83?
#   bash 83-vipimo-cash.sh andika     stdin = email, password ya CEO (FINANCE_WRITE) -> journal ya mkono
# Kinga: KABLA ya cutover D tu (D haijawekwa au leo < D); journal 9 lazima ziwe POSTED na Cr 1000 = 159,000;
#   kipindi cha leo kisifungwe; ikiwa journal ya 83 ipo tayari -> HAKUNA kinachoandikwa. Baada: TB 0, 1000 +159,000, 3900 -159,000.
set -uo pipefail
MODE="${1:-}"
H="${L83_HOME:-$HOME}"
DIR="${L83_DIR:-$H/lsms-deployment}"; PROJ="${L83_PROJ:-lsms-deployment}"; BASE="${L83_BASE:-http://localhost}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---83_IMESHINDWA---"; exit 1; }
TODAY="${L83_TODAY:-$(date +%F)}"
MARK="MAREKEBISHO-83-VIPIMO"
DESC="Marekebisho: manunuzi ya vipimo 20/02–17/08 hayakulipwa (Chief 10/11)"
DESC_JSON='Marekebisho: manunuzi ya vipimo 20/02\u201317/08 hayakulipwa (Chief 10/11)'   # JSON ya ASCII tu: en-dash imeandikwa kama escape ya unicode 2013
AMT=159000
PURS="'180d6a4c-ec3e-4a6a-bed4-3cadef4b2d9f','2ad6a559-15a0-4969-a565-59b3ec695946','5bd88c75-15e4-431e-ac41-ef5a03d612c3','5cf4df05-bb8d-425f-be09-f3d12a27e663','b5209495-8d25-452d-a81d-65488139f192','785548b1-a178-4b2a-b1ee-dc3b102dcf1c','a9b5b973-6e28-46a0-b6c1-76528d1f946e','ee99fd68-09ad-40f3-969e-37f3045b900a','e9bb33a8-b64c-4296-8c6d-65e8bda4a021'"
dc() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
   where l.account_code='$1' and e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
tb() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
salio() { echo "1000 Cash (Dr-Cr): $(dc 1000)   3900 (Dr-Cr): $(dc 3900)   TB: $(tb)"; }
pur_cr() { q "select count(distinct e.uid)||' | '||coalesce(sum(coalesce(l.credit_amount,0)-coalesce(l.debit_amount,0)) filter (where l.account_code='1000'),0)::numeric(19,0)
   from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_uid in ($PURS) and e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
done83() { q "select count(*) from journal_entry where reference_number = '$MARK' and not coalesce(is_deleted,false)"; }
cutover() { q "select coalesce((select bank_cutover_date::text from gl_config order by id limit 1),'')"; }
period() { q "select coalesce((select status from gl_period where period_year=extract(year from date '$TODAY') and period_month=extract(month from date '$TODAY')),'OPEN')"; }

if [ "$MODE" = kagua ]; then
  echo "=== 83 KAGUA $(date '+%F %T') - KUSOMA TU"
  echo "--- manunuzi 9 ya vipimo: tarehe | bidhaa | journal"
  q "select pu.purchase_date::date, p.product_name, pu.total_amount::numeric(19,0), pu.payment_status, coalesce((select string_agg(e.entry_date||' '||e.status||' ['||(select string_agg(l.account_code||':'||(l.debit_amount-l.credit_amount)::numeric(19,0), ',' order by l.account_code) from journal_entry_line l where l.journal_entry_uid=e.uid)||']', ' ; ') from journal_entry e where e.reference_uid=pu.uid),'HAKUNA JOURNAL')
     from purchases pu join products p on p.uid=pu.product_uid where pu.uid in ($PURS) order by pu.purchase_date, p.product_name"
  echo "journal POSTED | Cr 1000 jumla: $(pur_cr)   (lazima 9 | 159000)"
  c=$(cutover); echo "cutover D: ${c:-HAIJAWEKWA}   kipindi $TODAY: $(period)   journal ya 83 tayari: $(done83)"
  echo "--- salio SASA"; salio
  echo "journal itakuwa (tarehe $TODAY): Dr 1000 159,000 / Cr 3900 159,000 - '$DESC'"
  echo "makadirio BAADA: 1000 = $(q "select ($(dc 1000))::numeric + $AMT"), 3900 = $(q "select ($(dc 3900))::numeric - $AMT"), TB haibadiliki"
  echo "---83_KAGUA_MWISHO---"; exit 0
fi
[ "$MODE" = andika ] || { echo "MATUMIZI: $0 kagua | andika"; exit 2; }
IFS= read -r EMAIL || true; IFS= read -r PASS || true; EMAIL=${EMAIL%$'\r'}; PASS=${PASS%$'\r'}
[ -n "$EMAIL" ] && [ -n "$PASS" ] || die "email/password tupu"
echo "=== 83 ANDIKA $(date '+%F %T')"
[ "$(done83)" = 0 ] || die "journal ya 83 ($MARK) IPO TAYARI - hakuna kinachoandikwa mara ya pili"
c=$(cutover); [ -z "$c" ] || [[ "$TODAY" < "$c" ]] || die "cutover D ($c) imeshafika - (eh) 83 ni KABLA ya D; muulize Chief"
[ "$(period)" != CLOSED ] || die "kipindi cha $TODAY kimefungwa"
[ "$(pur_cr)" = "9 | 159000" ] || die "journal za manunuzi: $(pur_cr) (lazima 9 | 159000) - hali imebadilika, HAKUNA kilichoandikwa"
[ "$(q "select count(*) from gl_account where account_code in ('1000','3900') and is_active")" = 2 ] || die "akaunti 1000/3900 haipo au haitumiki"
echo "--- salio KABLA"; salio; C0=$(dc 1000); E0=$(dc 3900); T0=$(tb)
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
api() { HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X POST -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' ${TOKEN:+-H "Authorization: Bearer $TOKEN"} --data "$2" "$BASE$1"); }
okb() { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg() { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 300; }
TOKEN=; api /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"; PASS=
TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); [ -n "$TOKEN" ] || die "login HTTP $HC $(msg)"; echo "login SAWA"
api /api/v1/gl/journal-entries/manual "{\"entryDate\":\"$TODAY\",\"memo\":\"$MARK\",\"lines\":[{\"accountCode\":\"1000\",\"debit\":$AMT,\"credit\":0,\"description\":\"$DESC_JSON\"},{\"accountCode\":\"3900\",\"debit\":0,\"credit\":$AMT,\"description\":\"$DESC_JSON\"}]}"
okb || die "journal ya mkono HTTP $HC $(msg)"
REF=$(sed -n 's/.*"data" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); echo "journal SAWA: $REF"
q "select e.entry_number, e.entry_date, e.status, e.reference_number, l.account_code, l.debit_amount, l.credit_amount, l.description from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_uid='$REF' order by l.line_order"
echo "--- salio BAADA"; salio
[ "$(tb)" = "$T0" ] || die "TB imebadilika ($T0 -> $(tb))"
[ "$(q "select ($(dc 1000))::numeric = ($C0)::numeric + $AMT and ($(dc 3900))::numeric = ($E0)::numeric - $AMT")" = t ] || die "salio 1000/3900 halikubadilika kwa 159,000 kama ilivyotarajiwa"
echo "---83_MWISHO---"
