#!/usr/bin/env bash
# HATUA 93 marejesho-jaribio (mmiliki 13/11 he) - JARIBIO LA MAREJESHO (C4) KUPITIA API, STAGING TU (inaandika).
#   93-deploy-250.cmd staging marejesho-jaribio   (driver: email + password ya CEO kwa stdin, haziandikwi popote)
# Kila rekodi ina alama "MAREJESHO93-<saa>". Hatua:
#   0  swichi: GET /sales/returns/enabled = true (vinginevyo simama - endesha 'marejesho' + deploy kwanza)
#   1  siku X = siku HURU ya mtumiaji huyu (hana sale wala reco), >= siku ya kuhesabu mali ya mwisho na < leo (EAT)
#   2  sale A Taslimu (vipande 2) + sale B M-Pesa (kipande 1) siku X, za mtumiaji huyu
#   3  reco ya X: kuunda -> refresh -> taslimu iliyotangazwa = mauzo ya Taslimu, simu = M-Pesa -> kuthibitisha vitu -> submit
#      -> approve (CEO) -> APPROVED
#   4  marejesho LEO ya kipande 1 cha A (nzima), Taslimu -> PASS: reco ya X haibadiliki (status, auto_total_sales, auto-summary
#      ya X); droo ya leo inapungua bei ya kipande (returnDeductions); stock +1; GL Dr 4020 / Cr 1000 + Dr 1200 / Cr 5000; TB 0
#   5  marejesho LEO ya B (nzima), M-Pesa -> PASS: droo ya leo HAIPUNGUI; reco ya X haibadiliki; GL Cr 1030 / Dr 4020 (+ 1200/5000)
#   6  kusafisha: sale zenye marejesho HAZIFUTWI (kufuta sale yenye marejesho ni kasoro - ripoti he); zinabaki na alama, siku X
#      inatumiwa tena na jaribio hili; staging inarudishwa na refresh-db. TB 0 mwisho.
# Majaribio (PC): L93_PROJ, L93_DIR, L93_BASE - Docker-local.
set -uo pipefail
TARGET="${1:-}"
H="${L93_HOME:-$HOME}"
[ "$TARGET" = staging ] || { echo "SIYO: marejesho-jaribio inaandika - ni ya STAGING TU"; echo "---93K_IMESHINDWA---"; exit 2; }
PROJ=${L93_PROJ:-lsms-staging}; DIR="${L93_DIR:-$H/lsms-staging}"; BASE="${L93_BASE:-http://127.0.0.1:8081}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; echo "---93K_IMESHINDWA---"; exit 1; }
IFS= read -r EMAIL || true; IFS= read -r PASS || true
EMAIL=${EMAIL%$'\r'}; PASS=${PASS%$'\r'}
[ -n "$EMAIL" ] && [ -n "$PASS" ] || { echo "SIYO: email/password tupu"; echo "---93K_IMESHINDWA---"; exit 1; }
RUN="MAREJESHO93-$(TZ=Africa/Dar_es_Salaam date +%H%M%S)"
NOW=$(TZ=Africa/Dar_es_Salaam date +%Y-%m-%dT%H:%M:%S); TODAY=${NOW%%T*}
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
ok=0; bad=0
pass() { echo "PASS $*"; ok=$((ok+1)); }
fail() { echo "FAIL $*"; bad=$((bad+1)); }
stop() { fail "$*"; echo "MAREJESHO_MATOKEO PASS $ok FAIL $bad | alama $RUN"; echo "---93K_IMESHINDWA---"; exit 1; }
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F "|" -c "$SQL"' < /dev/null; }
api() {  # api METHOD PATH [json] -> HC, $T/b
  local m="$1" p="$2" d="${3:-}" a=()
  [ -n "${TOKEN:-}" ] && a=(-H "Authorization: Bearer $TOKEN")
  if [ -n "$d" ]; then HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X "$m" -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' "${a[@]}" --data "$d" "$BASE$p")
  else HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X "$m" -H 'Host: elikom.co.tz' "${a[@]}" "$BASE$p"); fi
}
okb()  { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg()  { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 200; }
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
jnum() { sed -n "s/.*\"$1\" *: *\(-\{0,1\}[0-9.]*\).*/\1/p" "$T/b" | head -n1; }   # namba ya kwanza ya ufunguo huo kwenye jibu
urlq() { printf '%s' "$1" | sed 's/ /%20/g'; }
gl()   { q "select coalesce(string_agg(a||':'||v, ',' order by a), '') from (select l.account_code a, round(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)), 2) v
         from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.status='POSTED' and not coalesce(e.is_deleted,false) and e.reference_uid in ($1)
         group by 1 having round(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)), 2) <> 0) x"; }
tb()   { q "select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false)"; }
auto() { api GET "/api/v1/reconciliation/auto-summary/$1"; }
eq()   { awk -v a="$1" -v b="$2" 'BEGIN { d = a - b; exit !(d < 0.005 && d > -0.005) }'; }

BE=$(docker inspect --format '{{.Config.Image}}' "$(docker compose -p "$PROJ" ps -q backend < /dev/null | head -n1)" | sed 's/.*://')
echo "=== 93 marejesho-jaribio $TARGET | backend $BE | $RUN | leo $TODAY"

api POST /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"
PASS=; TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1)
[ "$HC" = 200 ] && [ -n "$TOKEN" ] && pass "login ($BE)" || stop "login HTTP $HC: $(msg)"
ME=$(q "select uid || '|' || coalesce(nullif(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')),''), email) from users where lower(email)=lower('$(printf '%s' "$EMAIL" | sed "s/'/''/g")')")
UID_ME=${ME%%|*}

# 0 swichi
api GET /api/v1/sales/returns/enabled
grep -Eq '"data" *: *true' "$T/b" && pass "swichi ya marejesho IMEWASHWA kwenye backend hii" || stop "marejesho hayajawashwa (HTTP $HC $(msg)) - endesha 93 staging marejesho + deploy kwanza"

# 1 siku X (huru, au iliyotumiwa na jaribio hili tu: reco yake + sale zake zina alama MAREJESHO93 - jaribio linaweza kurudiwa)
LC=$(q "select coalesce(max(started_at)::date::text, '') from counting_session where status <> 'FORCE_CLOSED'")
X=$(q "select coalesce((select g::date::text from generate_series(date '$TODAY' - 1, greatest(date '$TODAY' - 25, coalesce(nullif('$LC','')::date, date '$TODAY' - 25)), interval '-1 day') g
      where not exists (select 1 from sales s where s.user_uid = '$UID_ME' and s.sale_date::date = g::date and coalesce(s.sale_notes,'') not like '%MAREJESHO93-%')
        and not exists (select 1 from daily_reconciliation r where r.user_uid = '$UID_ME' and r.reconciliation_date = g::date and coalesce(r.variance_explanation,'') not like '%MAREJESHO93-%')
      order by g desc limit 1), '')")
[ -n "$X" ] && pass "siku X = $X (huru kwa mtumiaji huyu, au ya jaribio hili tu; kuhesabu mali kwa mwisho ${LC:-HAKUNA}; < leo $TODAY)" \
  || stop "hakuna siku huru kati ya kuhesabu mali kwa mwisho (${LC:-?}) na jana kwa mtumiaji huyu"
XT="${X}T11:00:00"

# 2 sale A (Taslimu, vipande 2) + sale B (M-Pesa, kipande 1)
IFS='|' read -r PU PN PP PC PPP PS < <(q "select uid, product_name, piece_sale_price, coalesce(current_average_cost,0), coalesce(pieces_per_package,1), current_stock
  from products where coalesce(is_deleted,false)=false and coalesce(is_active,true) and current_stock >= 10 and piece_sale_price > coalesce(current_average_cost,0) * 1.05
   and product_name not ilike '%pima%' and not exists (select 1 from pour_product pp where pp.product_uid = products.uid and pp.active)
  order by current_stock desc, id limit 1")
[ -n "$PU" ] || stop "hakuna bidhaa ya jaribio (stock >= 10, bei > gharama)"
echo "bidhaa: $PN | bei $PP | gharama $PC | stock $PS"
sale() {  # sale <vipande> <njia> <alama>
  local n="$1" m="$2" tag="$3" amt; amt=$(awk -v a="$PP" -v n="$n" 'BEGIN { printf "%.2f", a * n }')
  api POST /api/v1/sales/partial "{\"saleDate\":\"$XT\",\"customerUid\":null,\"customerName\":\"Mteja wa jaribio la marejesho\",\"userUid\":\"$UID_ME\",
   \"discountAmount\":0,\"saleNotes\":\"$RUN $tag\",\"saleDetails\":[{\"productUid\":\"$PU\",\"productName\":\"$(jesc "$PN")\",\"saleType\":\"PIECES\",
   \"pieceQuantity\":$n,\"packageQuantity\":$n,\"unitPrice\":$PP,\"subTotal\":$amt,\"overrideUnitPrice\":null,\"costPerPiece\":$PC,\"piecesPerPackage\":$PPP}],
   \"payments\":[{\"customerUid\":null,\"customerName\":\"Mteja wa jaribio la marejesho\",\"paymentMethod\":\"$m\",\"totalAmount\":$amt,\"amountPaid\":$amt,\"paymentDate\":\"$XT\"}]}"
  sleep 1
  q "select coalesce((select uid from sales where sale_notes like '%$RUN $tag' order by id desc limit 1), '')"
}
SA=$(sale 2 CASH sale-A); okb && [ -n "$SA" ] && pass "sale A siku $X: vipande 2 Taslimu" || stop "sale A HTTP $HC: $(msg)"
SB=$(sale 1 VODACOM sale-B); okb && [ -n "$SB" ] && pass "sale B siku $X: kipande 1 M-Pesa" || stop "sale B HTTP $HC: $(msg)"
DA=$(q "select uid from sales_details where sale_uid='$SA' and not coalesce(is_deleted,false) limit 1")
DB=$(q "select uid from sales_details where sale_uid='$SB' and not coalesce(is_deleted,false) limit 1")
UNIT=$(q "select round(sub_total / piece_quantity, 2) from sales_details where uid='$DA'")
UCOST=$(q "select round(total_cost / piece_quantity, 2) from sales_details where uid='$DA'")

# 3 reco ya X -> APPROVED
api POST /api/v1/reconciliation "{\"reconciliationDate\":\"$X\"}"
RU=$(q "select coalesce((select uid from daily_reconciliation where reconciliation_date='$X' and user_uid='$UID_ME' and not coalesce(is_deleted,false) order by id desc limit 1), '')")
[ -n "$RU" ] || stop "reco ya $X HTTP $HC: $(msg)"
# alama ya jaribio kwenye reco MARA MOJA (siku inaweza kutumiwa tena na jaribio hili hata likikatika hapa)
api PUT "/api/v1/reconciliation/$RU/variance-explanation?explanation=$(urlq "$RUN jaribio la marejesho kwenye staging - tofauti ya jaribio")"
ST0=$(q "select status from daily_reconciliation where uid='$RU'")
if [ "$ST0" = APPROVED ]; then
  api POST "/api/v1/reconciliation/$RU/reopen?reason=$(urlq "$RUN jaribio la marejesho linarudiwa kwenye staging")"
  echo "reco ya $X (ya jaribio la awali) imefunguliwa: HTTP $HC $(msg)"
fi
api POST "/api/v1/reconciliation/$RU/refresh"
CASHX=$(awk -v a="$PP" 'BEGIN { printf "%.2f", a * 2 }')
api POST "/api/v1/reconciliation/$RU/cash-entry" "{\"entryType\":\"CASH_IN_HAND\",\"amount\":$CASHX,\"notes\":\"$RUN taslimu ya mauzo\"}"
CE=$HC
SUBM="tayari $(q "select status from daily_reconciliation where uid='$RU'")"
if [[ "$SUBM" =~ (DRAFT|REOPENED)$ ]]; then api POST "/api/v1/reconciliation/$RU/submit?zeroCashReason=$(urlq "$RUN jaribio")"; SUBM="$HC $(msg)"; fi
# vitu vinathibitishwa BAADA ya submit (submit inafanya refresh: mistari ya AUTO inaundwa upya)
for t in CASH MOBILE DEBT COLLECTION EXPENSE PURCHASE; do
  case $t in CASH) tb_=reconciliation_cash_entries;; MOBILE) tb_=reconciliation_mobile_entries;; DEBT) tb_=reconciliation_retail_debts;;
             COLLECTION) tb_=reconciliation_debt_collections;; EXPENSE) tb_=reconciliation_expenses;; PURCHASE) tb_=reconciliation_purchases;; esac
  for iu in $(q "select uid from $tb_ where reconciliation_uid='$RU' and not coalesce(is_deleted,false)" 2>/dev/null); do
    api POST "/api/v1/reconciliation/$RU/verify-item?itemType=$t&itemUid=$iu&verify=true&reason=$(urlq "$RUN jaribio la staging - CEO anathibitisha kipengele chake")"; okb || echo "verify $t $iu: HTTP $HC $(msg)"
  done
done
api POST "/api/v1/reconciliation/$RU/approve?notes=$(urlq "$RUN jaribio la marejesho")"
STX=$(q "select status from daily_reconciliation where uid='$RU'")
[ "$STX" = APPROVED ] && pass "reco ya $X IMEIDHINISHWA (taslimu iliyotangazwa $CASHX HTTP $CE)" || stop "reco ya $X haikuidhinishwa: $STX | submit $SUBM | approve HTTP $HC $(msg)"
RX0=$(q "select status || '|' || coalesce(auto_total_sales,0) || '|' || coalesce(reopen_count,0) from daily_reconciliation where uid='$RU'")
auto "$X"; AX0=$(jnum totalSales)
auto "$TODAY"; D0=$(jnum returnDeductions); D0=${D0:-0}
TB0=$(tb); S0=$(q "select current_stock from products where uid='$PU'")
echo "kabla: reco X $RX0 | auto-summary X totalSales $AX0 | leo returnDeductions $D0 | stock $S0 | TB $TB0"

# 4 marejesho LEO, kipande 1 cha A, Taslimu
api POST /api/v1/sales/returns "{\"saleUid\":\"$SA\",\"returnType\":\"PARTIAL_RETURN\",\"returnReason\":\"$RUN mteja amerudisha kipande kimoja\",
 \"returnItems\":[{\"saleDetailUid\":\"$DA\",\"productUid\":\"$PU\",\"quantity\":1,\"itemCondition\":\"GOOD\"}]}"
R1=$(sed -n 's/.*"uid" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1)
okb && [ -n "$R1" ] && [ "$(q "select return_status from sales_returns where uid='$R1'")" = PENDING ] && pass "ombi la marejesho A -> PENDING" || stop "ombi la marejesho A HTTP $HC: $(msg)"
api POST "/api/v1/sales/returns/$R1/approve" "{\"refundMethod\":\"CASH\",\"approvalNotes\":\"$RUN Taslimu\"}"
sleep 1
okb && [ "$(q "select return_status from sales_returns where uid='$R1'")" = APPROVED ] && pass "marejesho A IMEIDHINISHWA leo, Taslimu" || fail "kuidhinisha A HTTP $HC: $(msg)"
S1=$(q "select current_stock from products where uid='$PU'")
[ "$S1" = $((S0 + 1)) ] && pass "stock $S0 -> $S1 (+1)" || fail "stock $S0 -> $S1 (lazima +1)"
WANT1="1000:-$UNIT,1200:$UCOST,4020:$UNIT,5000:-$UCOST"
G1=$(gl "'$R1'")
[ "$G1" = "$WANT1" ] && pass "GL ya marejesho A: Dr 4020 / Cr 1000 + Dr 1200 / Cr 5000 ($G1)" || fail "GL ya marejesho A: '$G1' (lazima $WANT1)"
RX1=$(q "select status || '|' || coalesce(auto_total_sales,0) || '|' || coalesce(reopen_count,0) from daily_reconciliation where uid='$RU'")
auto "$X"; AX1=$(jnum totalSales)
[ "$RX1" = "$RX0" ] && eq "$AX1" "$AX0" && pass "reco ya $X HAIJABADILIKA (reco $RX1; auto-summary $AX1)" || fail "reco ya $X imebadilika: $RX0 -> $RX1 | auto-summary $AX0 -> $AX1"
auto "$TODAY"; D1=$(jnum returnDeductions); D1=${D1:-0}
eq "$(awk -v a="$D1" -v b="$D0" 'BEGIN { print a - b }')" "$UNIT" && pass "droo ya leo inapungua $UNIT (returnDeductions $D0 -> $D1)" || fail "droo ya leo: returnDeductions $D0 -> $D1 (lazima +$UNIT)"
TB1=$(tb); eq "$TB1" "$TB0" && eq "$TB1" 0 && pass "TB 0 ($TB1)" || fail "TB $TB0 -> $TB1"

# 5 marejesho LEO, B nzima, M-Pesa
api POST /api/v1/sales/returns "{\"saleUid\":\"$SB\",\"returnType\":\"PARTIAL_RETURN\",\"returnReason\":\"$RUN mteja amerudisha, alilipa M-Pesa\",
 \"returnItems\":[{\"saleDetailUid\":\"$DB\",\"productUid\":\"$PU\",\"quantity\":1,\"itemCondition\":\"GOOD\"}]}"
R2=$(sed -n 's/.*"uid" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1)
okb && [ -n "$R2" ] && pass "ombi la marejesho B -> PENDING" || fail "ombi la marejesho B HTTP $HC: $(msg)"
if [ -n "$R2" ]; then
  api POST "/api/v1/sales/returns/$R2/approve" "{\"refundMethod\":\"VODACOM\",\"approvalNotes\":\"$RUN M-Pesa\"}"
  sleep 1
  okb && [ "$(q "select return_status from sales_returns where uid='$R2'")" = APPROVED ] && pass "marejesho B IMEIDHINISHWA leo, M-Pesa" || fail "kuidhinisha B HTTP $HC: $(msg)"
  G2=$(gl "'$R2'")
  [[ "$G2" == *"1030:-$UNIT"* && "$G2" == *"4020:$UNIT"* && "$G2" != *"1000:"* ]] && pass "GL ya marejesho B: Cr 1030 / Dr 4020, hakuna 1000 ($G2)" || fail "GL ya marejesho B: '$G2' (lazima 1030:-$UNIT, 4020:$UNIT, bila 1000)"
  auto "$TODAY"; D2=$(jnum returnDeductions); D2=${D2:-0}
  eq "$D2" "$D1" && pass "M-Pesa HAITOLEWI droo (returnDeductions $D1 -> $D2)" || fail "M-Pesa imetolewa droo: returnDeductions $D1 -> $D2"
  RX2=$(q "select status || '|' || coalesce(auto_total_sales,0) || '|' || coalesce(reopen_count,0) from daily_reconciliation where uid='$RU'")
  auto "$X"; AX2=$(jnum totalSales)
  [ "$RX2" = "$RX0" ] && eq "$AX2" "$AX0" && pass "reco ya $X bado HAIJABADILIKA ($RX2; $AX2)" || fail "reco ya $X: $RX0 -> $RX2 | $AX0 -> $AX2"
  TB2=$(tb); eq "$TB2" 0 && pass "TB 0 ($TB2)" || fail "TB $TB2"
fi

# 6 kusafisha: sale zenye marejesho HAZIFUTWI (he, 13/11): kufuta sale yenye marejesho yaliyoidhinishwa kunarudisha stock na
#   mapato ya kipande kilichorudishwa MARA YA PILI (kasoro ya code iliyoonekana kwa jaribio hili - ripoti ya he). Sale za jaribio
#   zinabaki na alama (siku X inatumiwa tena na jaribio hili; staging inarudishwa na refresh-db). Reco ya X inabaki APPROVED.
echo "--- kusafisha (alama $RUN): sale zenye marejesho haziguswi; zinazobaki:"
q "select s.uid || ' ' || s.receipt_number || ' ' || s.total_amount || ' marejesho ' || (select count(*) from sales_returns r where r.original_sale_uid = s.uid)
   from sales s where s.user_uid='$UID_ME' and s.sale_date::date='$X' and s.sale_notes like '%MAREJESHO93-%' and coalesce(s.is_active,true)" | sed 's/^/BAKI: /'
TB3=$(tb); eq "$TB3" 0 && pass "TB 0 baada ya kusafisha ($TB3)" || fail "TB baada ya kusafisha $TB3"
echo "MAREJESHO_MATOKEO ($BE) PASS $ok FAIL $bad | alama $RUN | siku X $X"
[ "$bad" = 0 ] && { echo "MAREJESHO_OK $ok/$ok"; echo "---93K_MWISHO---"; exit 0; } || { echo "---93K_IMESHINDWA---"; exit 1; }
