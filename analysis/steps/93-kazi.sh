#!/usr/bin/env bash
# HATUA 93-kazi (mmiliki 12/11 ge; nakala ya 76-kazi kwa 2.5.0) - KAZI HALISI kupitia API + ukaguzi wa DB.
#   bash 76-kazi.sh <staging|prod> smoke   KUSOMA TU: login + GET za kawaida (2.3.0 na 2.4.0) -> SMOKE_OK n/n   (dg: K6 ya prod)
#   bash 76-kazi.sh staging kazi           INAANDIKA (STAGING TU): login, sale cash + GL journal, kufuta sale (+ reversal),
#                                          ununuzi + kuidhinisha + malipo ya msambazaji (+ GL), reco expense ongeza/futa -> KAZI_OK n/n
# stdin: mstari 1 = email, mstari 2 = password (kutoka driver, Read-Host ya siri). Thamani haziandikwi popote.
# Kila rekodi ya jaribio ina alama "KAZI93-<saa>" (sale_notes / purchase_notes / reference / description).
set -uo pipefail
TARGET="${1:-}"; MODE="${2:-}"
H="${L93_HOME:-$HOME}"
case "$TARGET" in
  prod)    PROJ=lsms-deployment; DIR="$H/lsms-deployment"; BASE="${L93_BASE:-http://localhost}" ;;
  staging) PROJ=lsms-staging;    DIR="$H/lsms-staging";    BASE="${L93_BASE:-http://127.0.0.1:8081}" ;;
  *) echo "MATUMIZI: $0 <staging|prod> <smoke|kazi>"; exit 2 ;;
esac
[ "$MODE" = smoke ] || [ "$MODE" = kazi ] || { echo "MATUMIZI: $0 <staging|prod> <smoke|kazi>"; exit 2; }
[ "$MODE" = kazi ] && [ "$TARGET" != staging ] && { echo "SIYO: 'kazi' inaandika - ni ya STAGING TU"; echo "---93K_IMESHINDWA---"; exit 2; }
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
IFS= read -r EMAIL || true; IFS= read -r PASS || true
EMAIL=${EMAIL%$'\r'}; PASS=${PASS%$'\r'}
[ -n "$EMAIL" ] && [ -n "$PASS" ] || { echo "SIYO: email/password tupu"; echo "---93K_IMESHINDWA---"; exit 1; }
RUN="KAZI93-$(TZ=Africa/Dar_es_Salaam date +%H%M%S)"
NOW=$(TZ=Africa/Dar_es_Salaam date +%Y-%m-%dT%H:%M:%S); TODAY=${NOW%%T*}
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
ok=0; bad=0
pass() { echo "PASS $*"; ok=$((ok+1)); }
fail() { echo "FAIL $*"; bad=$((bad+1)); }
chk()  { local n="$1"; shift; if "$@"; then pass "$n"; else fail "$n"; fi; }
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F "|" -c "$SQL"' < /dev/null; }
api() {  # api METHOD PATH [json] -> HC, $T/b
  local m="$1" p="$2" d="${3:-}" a=()
  [ -n "${TOKEN:-}" ] && a=(-H "Authorization: Bearer $TOKEN")
  if [ -n "$d" ]; then HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X "$m" -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' "${a[@]}" --data "$d" "$BASE$p")
  else HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X "$m" -H 'Host: elikom.co.tz' "${a[@]}" "$BASE$p"); fi
}
okb()  { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg()  { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 200; }   # backend inapanga JSON kwa nafasi
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

BE=$(docker inspect --format '{{.Config.Image}}' "$(docker compose -p "$PROJ" ps -q backend < /dev/null | head -n1)" | sed 's/.*://')
echo "=== 93-kazi $TARGET $MODE | backend $BE | $RUN"

# ── login ─────────────────────────────────────────────────────────────────────────────────────────────────
api POST /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"
PASS=; TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1)
if [ "$HC" = 200 ] && [ -n "$TOKEN" ]; then pass "login ($BE)"; else fail "login HTTP $HC: $(msg)"; echo "KAZI_IMESHINDWA (bila login hakuna kingine)"; echo "---93K_IMESHINDWA---"; exit 1; fi
UID_ME=$(q "select uid from users where lower(email)=lower('$(printf '%s' "$EMAIL" | sed "s/'/''/g")')")

if [ "$MODE" = smoke ]; then
  D7=$(TZ=Africa/Dar_es_Salaam date -d '-7 day' +%Y-%m-%d)
  for p in "/api/v1/sales?page=0&size=5" "/api/v1/purchases?page=0&size=5" "/api/v1/gl/trial-balance?startDate=$D7&endDate=$TODAY" \
           "/api/v1/gl/journal-entries?startDate=$D7&endDate=$TODAY&size=5" "/api/v1/gl/accounts" "/api/v1/notifications/unread-counts"; do
    api GET "$p"; if okb; then pass "GET ${p%%\?*}"; else fail "GET ${p%%\?*} HTTP $HC $(msg)"; fi
  done
  if { [ "$BE" = 2.4.0 ] || [ "$BE" = 2.5.0 ]; }; then
    api GET "/api/v1/sales/changes/pending"; if okb; then pass "GET /api/v1/sales/changes/pending (2.4.0)"; else fail "GET /sales/changes/pending HTTP $HC $(msg)"; fi
    n=$(q "select count(*) from login_audit where at > now() - interval '5 minutes' and result='SUCCESS'")
    [ "${n:-0}" -ge 1 ] && pass "login_audit imeandika login hii (2.4.0)" || fail "login_audit haina login ya dakika 5 zilizopita"
  fi
  echo "SMOKE_MATOKEO PASS $ok FAIL $bad"
  [ "$bad" = 0 ] && { echo "SMOKE_OK $ok/$ok"; echo "---93K_MWISHO---"; exit 0; } || { echo "---93K_IMESHINDWA---"; exit 1; }
fi

# ══════════════════════════════════════════ KAZI (staging tu) ════════════════════════════════════════════════
# 1. SALE CASH ------------------------------------------------------------------------------------------------
IFS='|' read -r PU PN PP PC PPP PS < <(q "select uid, product_name, piece_sale_price, coalesce(current_average_cost,0), coalesce(pieces_per_package,1), current_stock
  from products where coalesce(is_deleted,false)=false and current_stock >= 5 and piece_sale_price > 0 order by current_stock desc limit 1")
echo "bidhaa ya sale: $PN | bei $PP | stock $PS"
BODY=$(cat <<J
{"saleDate":"$NOW","customerUid":null,"customerName":"Mteja wa jaribio 93","customerPhoneNumber":null,"userUid":null,"userName":null,
 "discountAmount":0,"saleNotes":"$RUN sale ya jaribio","saleDetails":[{"productUid":"$PU","productName":"$(jesc "$PN")","productCategory":null,
 "saleType":"PIECES","pieceQuantity":1,"packageQuantity":1,"unitPrice":$PP,"subTotal":$PP,"overrideUnitPrice":null,"costPerPiece":$PC,
 "piecesPerPackage":$PPP,"packageAbbreviation":null}],
 "payments":[{"customerUid":null,"customerName":"Mteja wa jaribio 93","paymentMethod":"CASH","totalAmount":$PP,"amountPaid":$PP,"paymentDate":"$NOW","paymentNotes":null}]}
J
)
SBODY=$BODY   # (dk) inatumika tena kwa sale-B ya reco
api POST /api/v1/sales/partial "$BODY"
SU=$(q "select uid from sales where sale_notes like '%$RUN%' order by id desc limit 1")
if okb && [ -n "$SU" ]; then pass "sale cash imeandikwa ($(q "select receipt_number||' '||total_amount from sales where uid='$SU'"))"; else fail "sale HTTP $HC: $(msg)"; fi
if [ -n "$SU" ]; then
  S2=$(q "select current_stock from products where uid='$PU'")
  [ "$S2" = $((PS - 1)) ] && pass "stock $PS -> $S2" || fail "stock $PS -> $S2 (ilitarajiwa $((PS - 1)))"
  sleep 2
  JL=$(q "select string_agg(l.account_code||':'||(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0))::numeric(19,0), ',' order by l.account_code)
         from journal_entry e join journal_entry_line l on l.journal_entry_uid = e.uid where e.reference_uid='$SU' and coalesce(e.is_reversal,false)=false" 2>&1)
  JB=$(q "select count(*)||' '||coalesce(sum(total_debit-total_credit),0) from journal_entry where reference_uid='$SU' and coalesce(is_reversal,false)=false" 2>&1)
  echo "GL ya sale: $JL ($JB)"
  if [[ "$JL" == *"1000:"* ]] && [ "${JB%% *}" -ge 1 ] 2>/dev/null; then pass "GL journal ya sale ipo, inagusa 1000 ($JL)"; else fail "GL journal ya sale: '$JL' / '$JB'"; fi
fi
# 2. KUFUTA SALE ----------------------------------------------------------------------------------------------
if [ -n "$SU" ]; then
  api DELETE "/api/v1/sales/$SU?deleteReason=$(printf '%s' "Jaribio 93 kufuta sale $RUN" | sed 's/ /%20/g')"
  if okb; then pass "sale imefutwa (API)"; else fail "kufuta sale HTTP $HC: $(msg)"; fi
  A=$(q "select coalesce(is_active::text,'?') from sales where uid='$SU'")
  [ "$A" = false ] && pass "sales.is_active=false" || fail "sales.is_active=$A"
  S3=$(q "select current_stock from products where uid='$PU'")
  [ "$S3" = "$PS" ] && pass "stock imerudi $S3" || fail "stock baada ya kufuta $S3 (ilitarajiwa $PS)"
  R=$(q "select count(*) from journal_entry where reference_uid='$SU' and coalesce(is_reversal,false)=true")
  [ "${R:-0}" -ge 1 ] && pass "GL reversal ya sale ipo ($R)" || fail "hakuna GL reversal ya sale"
  if { [ "$BE" = 2.4.0 ] || [ "$BE" = 2.5.0 ]; }; then
    AU=$(q "select action||'/'||result from sale_change_audit where sale_uid='$SU' order by id desc limit 1")
    [ "$AU" = DELETE/ALLOWED ] && pass "sale_change_audit DELETE/ALLOWED (2.4.0)" || fail "sale_change_audit: '$AU'"
  fi
fi
# 3. UNUNUZI + MALIPO YA MSAMBAZAJI ---------------------------------------------------------------------------
# Ununuzi: "Nunua tena" (repurchase/bulk, kama V3) - unafanya kazi kwa bidhaa yoyote isiyo na ununuzi PENDING/APPROVED.
# Malipo: kwa msambazaji aliyesajiliwa (on-account, bila purchaseUid), kisha yanafutwa (reversal) ili salio lisibaki.
IFS='|' read -r SPU SPN < <(q "select uid, name from suppliers where coalesce(is_deleted,false)=false and coalesce(is_active,true) order by id limit 1")
IFS='|' read -r QU QN < <(q "select pr.uid, pr.product_name from products pr where coalesce(pr.is_deleted,false)=false
   and not exists (select 1 from purchases x where x.product_uid=pr.uid and x.status in ('PENDING','APPROVED'))
   order by pr.id desc limit 1")
P0=$(q "select coalesce(max(id),0) from purchases")
echo "bidhaa ya ununuzi: $QN | msambazaji wa malipo: $SPN"
BODY="{\"paymentSource\":\"DROO\",\"sourceAccount\":null,\"items\":[{\"productUid\":\"$QU\",\"useLastPurchaseData\":false,\"purchaseType\":\"INDIVIDUAL_PIECES\",
 \"priceInputMode\":\"PER_PIECE\",\"quantity\":1,\"purchasePrice\":100,\"supplierName\":\"$RUN\"}]}"
api POST /api/v1/purchases/repurchase/bulk "$BODY"
PUU=$(q "select uid from purchases where product_uid='$QU' and id > $P0 order by id desc limit 1")
if [ -n "$PUU" ]; then pass "ununuzi umeandikwa ($(q "select status||' '||total_amount from purchases where uid='$PUU'"))"; else fail "ununuzi HTTP $HC: $(msg)"; fi
if [ -n "$PUU" ]; then
  api POST "/api/v1/purchases/$PUU/approve?approvalNotes=$RUN" '{}'
  ST=$(q "select status from purchases where uid='$PUU'")
  [ "$ST" = APPROVED ] && pass "ununuzi APPROVED" || fail "ununuzi status $ST HTTP $HC $(msg)"
  sleep 2
  PJ=$(q "select string_agg(l.account_code||':'||(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0))::numeric(19,0), ',' order by l.account_code)
         from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_uid='$PUU' and coalesce(e.is_reversal,false)=false" 2>&1)
  [[ "$PJ" == *"1200:100"* ]] && pass "GL ya ununuzi ($PJ)" || fail "GL ya ununuzi: '$PJ'"
fi
BODY="{\"supplierUid\":\"$SPU\",\"amount\":100,\"paymentMethod\":\"CASH\",\"paymentSource\":\"DROO\",\"sourceAccount\":null,
 \"paymentDate\":\"$NOW\",\"reference\":\"$RUN\",\"notes\":\"malipo ya jaribio 93\"}"
api POST /api/v1/supplier-payments "$BODY"
PY=$(q "select uid from supplier_payments where reference='$RUN' and coalesce(is_deleted,false)=false order by id desc limit 1")
if okb && [ -n "$PY" ]; then pass "malipo ya msambazaji yameandikwa"; else fail "malipo HTTP $HC: $(msg)"; fi
if [ -n "$PY" ]; then
  sleep 2
  YJ=$(q "select string_agg(l.account_code||':'||(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0))::numeric(19,0), ',' order by l.account_code)
         from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_uid='$PY' and coalesce(e.is_reversal,false)=false" 2>&1)
  [[ "$YJ" == *"2000:100"* ]] && pass "GL ya malipo ($YJ)" || fail "GL ya malipo: '$YJ'"
  api DELETE "/api/v1/supplier-payments/$PY"
  D=$(q "select count(*) from supplier_payments where uid='$PY' and coalesce(is_deleted,false)=false")
  okb && [ "$D" = 0 ] && pass "malipo yamefutwa (reversal)" || fail "kufuta malipo HTTP $HC (bado: $D) $(msg)"
fi
# 4. RECO ENTRY (expense: ongeza + futa) ---------------------------------------------------------------------
# (dk) reco ya siku inahitaji mauzo ya siku hiyo: sale-B ya jaribio INABAKI mpaka reco (create + expense + kufuta
# expense) ikamilike, kisha inafutwa. (Staging haina mauzo ya leo - duka limefungwa.)
api POST /api/v1/sales/partial "${SBODY//"$RUN sale ya jaribio"/"$RUN sale-B ya reco"}"
SB=$(q "select uid from sales where sale_notes like '%$RUN sale-B%' order by id desc limit 1")
if okb && [ -n "$SB" ]; then pass "sale-B ya reco imeandikwa (inabaki mpaka reco iishe)"; else fail "sale-B HTTP $HC: $(msg)"; fi
api POST /api/v1/reconciliation "{\"reconciliationDate\":\"$TODAY\"}"
RU=$(q "select uid from daily_reconciliation where reconciliation_date='$TODAY' and user_uid='$UID_ME' order by id desc limit 1")
if [ -n "$RU" ]; then pass "reco ya leo ipo ($(q "select status from daily_reconciliation where uid='$RU'"))"; else fail "reco ya leo HTTP $HC: $(msg)"; fi
if [ -n "$RU" ]; then
  api POST "/api/v1/reconciliation/$RU/expense" "{\"expenseType\":\"USAFIRI\",\"description\":\"$RUN gharama ya jaribio\",\"amount\":100,\"receiptReference\":null,\"notes\":null}"
  EU=$(q "select uid from reconciliation_expenses where description like '%$RUN%' order by id desc limit 1")
  if okb && [ -n "$EU" ]; then pass "reco expense imeongezwa"; else fail "reco expense HTTP $HC: $(msg)"; fi
  if [ -n "$EU" ]; then
    api DELETE "/api/v1/reconciliation/$RU/expense/$EU"
    G=$(q "select count(*) from reconciliation_expenses where uid='$EU' and coalesce(is_deleted,false)=false")
    okb && [ "$G" = 0 ] && pass "reco expense imefutwa" || fail "kufuta reco expense HTTP $HC (bado ipo: $G) $(msg)"
  fi
fi
if [ -n "$SB" ]; then
  api DELETE "/api/v1/sales/$SB?deleteReason=$(printf '%s' "Jaribio 93 kufuta sale-B $RUN" | sed 's/ /%20/g')"
  A=$(q "select coalesce(is_active::text,'?') from sales where uid='$SB'"); S4=$(q "select current_stock from products where uid='$PU'")
  okb && [ "$A" = false ] && [ "$S4" = "$PS" ] && pass "sale-B imefutwa baada ya reco (stock $S4)" || fail "kufuta sale-B HTTP $HC active=$A stock=$S4 $(msg)"
fi
echo "KAZI_MATOKEO ($BE) PASS $ok FAIL $bad | rekodi za jaribio: alama $RUN"
[ "$bad" = 0 ] && { echo "KAZI_OK $ok/$ok"; echo "---93K_MWISHO---"; exit 0; } || { echo "---93K_IMESHINDWA---"; exit 1; }
