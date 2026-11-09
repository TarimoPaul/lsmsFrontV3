#!/usr/bin/env bash
# HATUA 80 (mmiliki 09/11 dq/dr) - PROD: marekebisho ya gharama za 2026. KAGUA -> STOP (Chief) -> ANDIKA kwa sehemu.
#   bash 80-marekebisho-gharama.sh kagua          KUSOMA TU: kila row/journal + salio kabla na (makadirio) baada
#   bash 80-marekebisho-gharama.sh andika a       watoto 11 BILA journal -> CANCELLED kupitia API (hakuna GL)
#   bash 80-marekebisho-gharama.sh andika d       Azam x2 + TTCL x1 za Nov -> CANCELLED kupitia API (API inabatilisha journal)
#   bash 80-marekebisho-gharama.sh andika b       Pango (Frame): akaunti 2400 (ikikosekana) + journal ya mkono ya Novemba
#   (c) TRA: IMEZUIWA mpaka Chief aseme 185,000 ililipwa lini/kutoka wapi (dr-c).
# andika: stdin = email, password (CEO; FINANCE_WRITE + CAPITAL_APPROVE). Kila sehemu: ukaguzi wa awali; ikikosa -> SIMAMA bila kuandika.
# Kila sehemu ni idempotent (iliyokwisha fanyika inarukwa). Baada ya kila andika: TB (Dr = Cr) na salio.
set -uo pipefail
MODE="${1:-}"; PART="${2:-}"
H="${L80_HOME:-$HOME}"
DIR="${L80_DIR:-$H/lsms-deployment}"; PROJ="${L80_PROJ:-lsms-deployment}"; BASE="${L80_BASE:-http://localhost}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---80_IMESHINDWA---"; exit 1; }

# ── orodha (kutoka 79, 09/11 15:16) ─────────────────────────────────────────────────────────────────────────
A_REFS="TAX-MON-20260101-000000-DA4470C9 TAX-MON-20260201-000000-804FBAA3 TAX-MON-20260301-000000-B71BFD03 TAX-MON-20260401-000000-8F367691
TAX-MON-20260501-000000-2F5B475B TAX-MON-20260601-000000-05367008 TAX-MON-20260701-000000-FC48A707 TAX-MON-20260801-000000-982287F9
TAX-MON-20260901-000000-31963E86 TAX-MON-20261001-000000-866ADE03 REN-MON-20261001-000000-F4B73208"
D_REV="OPE-MON-20261101-000000-9CB440F1 OPE-MON-20261101-000000-36910E6D OPE-MON-20261101-000000-A4A2EBD8"
D_KEEP="OPE-MON-20261101-000000-F681592A OPE-MON-20261101-000000-C1B0BA4D"
DEC_STOPPED="OPE-MON-20261201-000000-9A8E8A51 OPE-MON-20261201-000000-BAB17D9D OPE-MON-20261201-000000-445F7E17 REN-MON-20261201-000000-9331734F TAX-MON-20261201-000000-F9B5339C"
# majaribio tu (Docker-local): orodha zinaweza kubadilishwa kwa env L80_*
A_REFS="${L80_A_REFS:-$A_REFS}"; A_N="${L80_A_N:-11}"; D_REV="${L80_D_REV:-$D_REV}"; D_KEEP="${L80_D_KEEP:-$D_KEEP}"; D_MONTH="${L80_D_MONTH:-11}"
B_MARK="MAREKEBISHO-80B"
# memo inahifadhiwa kwenye journal_entry.reference_number = varchar(100) (mazoezi ya local 09/11) -> fupi; maelezo kamili yako kwenye mistari
B_MEMO="Marekebisho ya 2026 - Kodi ya Frame Jan-Nov ($B_MARK)"
inlist() { echo "$1" | tr ' \n' '\n\n' | grep -v '^$' | sed "s/.*/'&'/" | paste -sd, -; }
JL="(select string_agg(e.entry_date||' '||e.status||case when coalesce(e.is_reversal,false) then ' REV' else '' end||' ['||(select string_agg(l.account_code||':'||(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0))::numeric(19,2), ',' order by l.account_code) from journal_entry_line l where l.journal_entry_uid=e.uid)||']', ' ; ' order by e.id) from journal_entry e where e.reference_uid=c.uid)"
salio() {  # salio la akaunti (Dr - Cr), yote na ya 2026
  q "select a.account_code, a.account_name_sw,
     coalesce((select sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code=a.account_code and e.status='POSTED'),0)::numeric(19,2) as yote,
     coalesce((select sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code=a.account_code and e.status='POSTED' and extract(year from e.entry_date)=2026),0)::numeric(19,2) as y2026
     from gl_account a where a.account_code in ('1000','2200','2300','2400','6000','6200','6800') order by 1"
  echo "TB (Dr - Cr, zote POSTED): $(q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED'")"
}
frame_gl() {
  echo "Frame 2026 - journal zilizopo (rows za capex zenye 'frame' isipokuwa usafi):"
  q "select c.reference_number, left(c.description,50), c.amount, c.status, coalesce(c.is_deleted,false), coalesce($JL,'-') from capital_expenditure c
     where c.description ilike '%frame%' and c.description not ilike '%usafi%' order by c.id"
  echo "Journal ya marekebisho ya 80b iliyopo: $(q "select count(*) from journal_entry where reference_number like '%$B_MARK%'")"
}

if [ "$MODE" = kagua ]; then
  echo "=== 80 KAGUA $(date '+%F %T') - KUSOMA TU"
  echo "--- vipindi: $(q "select string_agg(period_year||'-'||lpad(period_month::text,2,'0')||' '||status, ', ' order by period_year, period_month) from gl_period where period_year=2026")"
  echo "=== (a) watoto 11 BILA journal -> CANCELLED (hakuna GL). ref | mwezi | kiasi | status | imefutwa | journal zote | dirisha la postDue (siku 45)?"
  q "select c.reference_number, c.allocated_year||'-'||lpad(c.allocated_month::text,2,'0'), c.amount, c.status, coalesce(c.is_deleted,false),
     (select count(*) from journal_entry e where e.reference_uid=c.uid),
     case when c.transaction_date >= current_date - 45 then 'NDANI (00:10 kila usiku)' else 'nje' end
     from capital_expenditure c where c.reference_number in ($(inlist "$A_REFS")) order by c.reference_number"
  echo "idadi: $(q "select count(*)||' rows, jumla '||coalesce(sum(amount),0)||', zenye journal: '||count(*) filter (where exists (select 1 from journal_entry e where e.reference_uid=c.uid)) from capital_expenditure c where c.reference_number in ($(inlist "$A_REFS"))") (lazima 11 rows, journal 0)"
  echo "gl_posting_failure za rows hizi: "; q "select f.created_at::timestamp(0), f.source_number, f.entry_date, f.attempts, coalesce(f.resolution,'-'), left(f.error,120) from gl_posting_failure f join capital_expenditure c on c.uid in (f.source_uid, f.reference_uid) where c.reference_number in ($(inlist "$A_REFS")) order by f.id"
  echo "=== (d) Novemba: reverse (Azam x2, TTCL x1) | baki. ref | template | template hai? | kiasi | status | journal"
  q "select case when c.reference_number in ($(inlist "$D_REV")) then 'REVERSE' else 'BAKI' end, c.reference_number, t.reference_number, t.recurring_active, c.amount, c.status, coalesce($JL,'-')
     from capital_expenditure c join capital_expenditure t on t.uid=c.parent_capital_expenditure_uid
     where c.reference_number in ($(inlist "$D_REV $D_KEEP")) order by 1 desc, 2"
  echo "--- Desemba za budget zilizosimamishwa (lazima imefutwa=t):"
  q "select c.reference_number, coalesce(c.is_deleted,false), c.status from capital_expenditure c where c.reference_number in ($(inlist "$DEC_STOPPED")) order by 1"
  echo "--- Desemba za budget HAI (zinabaki, zitaandikwa 01/12):"
  q "select c.reference_number, left(c.description,40), c.amount from capital_expenditure c join capital_expenditure t on t.uid=c.parent_capital_expenditure_uid
     where t.recurring_active and c.allocated_year=2026 and c.allocated_month=12 and not coalesce(c.is_deleted,false) order by 1"
  echo "=== (b) PANGO / FRAME"
  frame_gl
  echo "akaunti 2400: $(q "select coalesce((select account_code||' '||account_name||' / '||account_name_sw||' '||account_type||' active='||is_active from gl_account where account_code='2400'),'HAIPO - itaongezwa: 2400 Accrued Expenses / Gharama Zinazodaiwa, LIABILITY, CURRENT_LIABILITY, CREDIT')")"
  echo "journal itakayoandikwa (tarehe = leo, Novemba): Dr 6000 1,800,000 | Dr 1000 400,000 | Cr 2300 1,800,000 | Cr 2400 400,000"
  echo "  -> Frame 2026 baada: gharama 200,000 (6200, 01/01) + 200,000 (6000, 01/11) + 1,800,000 = 2,200,000 (Jan-Nov); 1000 ya Frame = 0; 2300 +1,800,000; 2400 400,000"
  echo "  -> DESEMBA (hatua tofauti tarehe 01/12 au baadaye; journal ya mkono haikubali tarehe ya baadaye): Dr 6000 200,000 / Cr 2400 200,000 -> 2,400,000 / 600,000"
  echo "=== (c) TRA (IMEZUIWA): rows na journal za 2026"
  q "select c.reference_number, c.allocated_year||'-'||lpad(coalesce(c.allocated_month,0)::text,2,'0'), c.amount, c.status, coalesce(c.is_deleted,false), coalesce($JL,'-')
     from capital_expenditure c where c.description ~* '(^|[^a-z])tra([^a-z]|\$)' and (exists (select 1 from journal_entry e where e.reference_uid=c.uid)) order by c.id"
  echo "  GL ya TRA 2026 sasa: 20,833.33 (6200, 01/01) + 250,000 (6800, 01/11) = 270,833.33, yote Cr 1000. Lengo: gharama 250,000; 65,000 -> 2200 (inadaiwa);"
  echo "  185,000 -> chanzo cha Chief. Mstari wa marekebisho (USIANDIKWE bado): Dr 1000 270,833.33 | Cr 6200 20,833.33 | Cr 2200 65,000 | Cr <chanzo> 185,000"
  echo "=== SALIO SASA"
  salio
  echo "--- makadirio baada ya a+d+b: 1000 +400,000 (b) +111,000 (d: reversal 28,000x2 + 55,000); 6000 +1,800,000; 6200 -111,000 (d, ikiwa Azam/TTCL ni 6200); 2300 -1,800,000 (Cr); 2400 -400,000 (Cr)"
  echo "---80_KAGUA_MWISHO---"; exit 0
fi

[ "$MODE" = andika ] || { echo "MATUMIZI: $0 kagua | andika <a|b|d>"; exit 2; }
case "$PART" in a|b|d) ;; c) die "(c) TRA imezuiwa mpaka Chief athibitishe chanzo cha 185,000 (dr-c)";; *) die "sehemu '$PART' haijulikani (a|b|d)";; esac
IFS= read -r EMAIL || true; IFS= read -r PASS || true; EMAIL=${EMAIL%$'\r'}; PASS=${PASS%$'\r'}
[ -n "$EMAIL" ] && [ -n "$PASS" ] || die "email/password tupu"
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
api() { local m="$1" p="$2" d="${3:-}"
  if [ -n "$d" ]; then HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X "$m" -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' ${TOKEN:+-H "Authorization: Bearer $TOKEN"} --data "$d" "$BASE$p")
  else HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X "$m" -H 'Host: elikom.co.tz' ${TOKEN:+-H "Authorization: Bearer $TOKEN"} "$BASE$p"); fi; }
okb() { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg() { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 300; }
urlenc() { printf '%s' "$1" | sed 's/%/%25/g; s/ /%20/g; s/(/%28/g; s/)/%29/g; s/,/%2C/g; s/:/%3A/g; s/\//%2F/g'; }
login() { TOKEN=; api POST /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"; PASS=
  TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); [ -n "$TOKEN" ] || die "login HTTP $HC $(msg)"; echo "login SAWA"; }
cancel_ref() {  # cancel_ref <ref> <sababu>
  local uid st; IFS='|' read -r uid st < <(q "select uid, status from capital_expenditure where reference_number='$1'" | tr -d ' ')
  [ "$st" = CANCELLED ] && { echo "  $1: tayari CANCELLED - inarukwa"; return 0; }
  api PATCH "/api/v1/capital-expenditure/$uid/status?newStatus=CANCELLED&reason=$(urlenc "$2")"
  st=$(q "select status from capital_expenditure where uid='$uid'")
  okb && [ "$st" = CANCELLED ] && echo "  $1: CANCELLED SAWA" || die "$1: HTTP $HC status=$st $(msg)"
}
echo "=== 80 ANDIKA ($PART) $(date '+%F %T')"; echo "--- salio KABLA"; salio

if [ "$PART" = a ]; then
  n=$(q "select count(*) from capital_expenditure c where c.reference_number in ($(inlist "$A_REFS"))")
  j=$(q "select count(*) from journal_entry e join capital_expenditure c on c.uid=e.reference_uid where c.reference_number in ($(inlist "$A_REFS"))")
  bad=$(q "select count(*) from capital_expenditure c where c.reference_number in ($(inlist "$A_REFS")) and c.status not in ('APPROVED','CANCELLED')")
  [ "$n" = "$A_N" ] && [ "$j" = 0 ] && [ "$bad" = 0 ] || die "ukaguzi wa awali: rows $n ($A_N), journal $j (0), status nyingine $bad (0) - HAKUNA kilichoandikwa"
  login
  for r in $A_REFS; do cancel_ref "$r" "Marekebisho ya 2026 (80a): mtoto wa budget bila journal, ameundwa kwa backfill 04/11"; done
  j2=$(q "select count(*) from journal_entry e join capital_expenditure c on c.uid=e.reference_uid where c.reference_number in ($(inlist "$A_REFS"))")
  [ "$j2" = 0 ] || die "baada ya (a) journal $j2 - zilitarajiwa 0"
  echo "(a) SAWA: $A_N CANCELLED, journal 0 (GL haijaguswa)"
fi

if [ "$PART" = d ]; then
  chk=$(q "select count(*) from capital_expenditure c join capital_expenditure t on t.uid=c.parent_capital_expenditure_uid
     where c.reference_number in ($(inlist "$D_REV")) and not t.recurring_active and c.allocated_year=2026 and c.allocated_month=$D_MONTH")
  keep=$(q "select count(*) from capital_expenditure c join capital_expenditure t on t.uid=c.parent_capital_expenditure_uid
     where c.reference_number in ($(inlist "$D_KEEP")) and t.recurring_active and c.status='APPROVED' and not coalesce(c.is_deleted,false)")
  [ "$chk" = "$(echo $D_REV | wc -w)" ] && [ "$keep" = "$(echo $D_KEEP | wc -w)" ] || die "ukaguzi wa awali: za kureverse $chk (3, template zimesimamishwa), za kubaki $keep (2, template hai) - HAKUNA kilichoandikwa"
  login
  for r in $D_REV; do cancel_ref "$r" "Marekebisho ya 2026 (80d): nakala ya Novemba - Azam/TTCL ni moja tu kila mwezi"; done
  echo "--- journal baada:"; q "select c.reference_number, c.status, coalesce($JL,'-') from capital_expenditure c where c.reference_number in ($(inlist "$D_REV $D_KEEP")) order by 1"
  act=$(q "select count(*) from journal_entry e join capital_expenditure c on c.uid=e.reference_uid where c.reference_number in ($(inlist "$D_REV")) and e.status='POSTED' and not coalesce(e.is_reversal,false)
     and not exists (select 1 from journal_entry r where r.reversed_entry_uid=e.uid)")
  [ "$act" = 0 ] || die "baada ya (d) bado kuna journal $act ambazo hazijabatilishwa"
  echo "(d) SAWA: $(echo $D_REV | wc -w) CANCELLED, journal zao zimebatilishwa"
fi

if [ "$PART" = b ]; then
  [ "$(q "select count(*) from journal_entry where reference_number like '%$B_MARK%'")" = 0 ] || { echo "(b) journal ya $B_MARK tayari ipo - inarukwa"; frame_gl; salio; echo "---80_MWISHO---"; exit 0; }
  [ "$(q "select status from gl_period where period_year=2026 and period_month=11")" != CLOSED ] || die "Novemba imefungwa"
  # kinga: journal 400,000 Cr 1000 inarudisha Cr 1000 za Frame 01/01 (F7C9E331) + 01/11 (5D9DD844) - lazima ziwe hai na jumla 400,000
  CR=$(q "select coalesce(sum(l.credit_amount-l.debit_amount),0)::numeric(19,0) from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid
         join capital_expenditure c on c.uid=e.reference_uid where c.reference_number in (${L80_B_REFS:-'OPE-MON-20260101-000000-F7C9E331','REN-MON-20261101-000000-5D9DD844'})
         and l.account_code='1000' and e.status='POSTED'")
  [ "$CR" = "${L80_B_CR:-400000}" ] || die "Cr 1000 za Frame (F7C9E331 + 5D9DD844) ni $CR, si 400000 - hali imebadilika, HAKUNA kilichoandikwa"
  if [ "$(q "select count(*) from gl_account where account_code='2400'")" = 0 ]; then
    q "insert into gl_account (uid, account_code, account_name, account_name_sw, account_type, account_category, normal_balance, is_active, is_system, sort_order, description)
       values (gen_random_uuid(), '2400', 'Accrued Expenses', 'Gharama Zinazodaiwa', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', true, true, 2400,
       'Hatua 80 (dr) 09/11/2026: gharama zilizotumika lakini bado hazijalipwa (mf. pango la Frame Okt-Des 2026)') on conflict (account_code) do nothing" > /dev/null || die "kuongeza 2400 kumeshindwa"
    echo "akaunti 2400 imeongezwa"
  fi
  login
  BODY="{\"entryDate\":\"$(date +%F)\",\"memo\":\"$(jesc "$B_MEMO")\",\"lines\":[
   {\"accountCode\":\"6000\",\"debit\":1800000,\"credit\":0,\"description\":\"Pango la Frame Jan-Sep 2026 (alilipa Chief) - $B_MARK\"},
   {\"accountCode\":\"1000\",\"debit\":400000,\"credit\":0,\"description\":\"Kurudisha Cr 1000 za Frame 01/01 na 01/11 (hazikutoka kwenye biashara) - $B_MARK\"},
   {\"accountCode\":\"2300\",\"debit\":0,\"credit\":1800000,\"description\":\"Deni kwa mmiliki: Chief alilipa pango la Frame Jan-Sep 2026 - $B_MARK\"},
   {\"accountCode\":\"2400\",\"debit\":0,\"credit\":400000,\"description\":\"Pango la Frame Okt-Nov 2026 linalodaiwa - $B_MARK\"}]}"
  api POST /api/v1/gl/journal-entries/manual "$BODY"
  okb || die "journal ya mkono HTTP $HC $(msg)"
  REF=$(sed -n 's/.*"data" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); echo "journal SAWA: $REF"
  q "select e.entry_number, e.entry_date, e.status, l.account_code, l.debit_amount, l.credit_amount from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_uid='$REF' order by l.line_order"
  frame_gl
fi
echo "--- salio BAADA"; salio
echo "---80_MWISHO---"
