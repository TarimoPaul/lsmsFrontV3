#!/usr/bin/env bash
# HATUA 60 (mmiliki 28/10 x; 11/11 fd/fe; 12/11 ff) - SIKU YA CUTOVER D: journal ya ufunguzi ya salio HALISI la benki/simu + tarehe D.
#   bash 60-ufunguzi.sh kagua    KUSOMA TU: salio la GL kabla ya D, journal itakayoandikwa, tofauti ya pesa taslimu, kinga zote
#   bash 60-ufunguzi.sh andika   stdin = email, password ya CEO (FINANCE_WRITE) -> journal ya ufunguzi -> (tofauti) -> D
# Thamani (env, TZS, bila koma): L60_D (= LEO, asubuhi kabla ya duka kufunguliwa), L60_NMB, L60_SELCOM, L60_MPESA, L60_TIGO
#   (salio la taarifa za benki/simu la jioni ya jana); (fj) akaunti nyingine zote ziko WAZI na zinapata salio la ufunguzi pia:
#   L60_CRDB, L60_NBC, L60_PCB, L60_HALOPESA, L60_AIRTEL (haijatajwa = 0, yaani haitumiki); L60_TASLIMU (pesa taslimu YOTE: droo + sefu + bahasha), L60_BAHASHA
#   (sehemu ya TASLIMU iliyo bahasha ya akiba - taarifa tu).
# Kanuni (fd): kabla ya D, NMB/Selcom/simu ni sehemu ya 1000. Ufunguzi UNAWEKA kila akaunti = salio halisi (tofauti tu inaandikwa,
#   k.m. 1030 tayari ina 163,000 ya mauzo ya M-Pesa -> journal ni salio halisi - 163,000), na kiasi hicho kinatoka 1000:
#   Dr/Cr 1021, 1023, 1030, 1031 / Cr/Dr 1000. Journal hii ni uhamisho tu: TB haibadiliki.
#   Kisha 1000 inapaswa kuwa = TASLIMU. Tofauti yoyote (fg, Qff-2) = journal ya pili WAZI kwenda akaunti ya MUDA 2910 "Tofauti ya
#   ufunguzi" (V150; si 1000, si 3900): 1000 = TASLIMU. Ndani ya siku 30: kinachoelezeka -> akaunti sahihi; kisichoelezeka -> 3900
#   kwa uamuzi wa CEO + taarifa kwa Executive CEO (journal ya mkono, si script hii).
# Mpangilio: kinga zote -> journal ya ufunguzi (API, tarehe D) -> tofauti -> D (60-bank-cutover.sql, kinga zake). Mara ya pili:
#   journal iliyopo inarukwa (kiasi lazima kilingane), D ileile = CUTOVER_TAYARI. Maandishi ni ASCII.
set -uo pipefail
MODE="${1:-}"
H="${L60_HOME:-$HOME}"
DIR="${L60_DIR:-$H/lsms-deployment}"; PROJ="${L60_PROJ:-lsms-deployment}"; BASE="${L60_BASE:-http://localhost}"
SQLF="${L60_SQL:-$(cd "$(dirname "$0")" && pwd)/60-bank-cutover.sql}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---60_IMESHINDWA---"; exit 1; }
TODAY="$(date +%F)"
D="${L60_D:-}"
MARK="UFUNGUZI-60"; MARKT="UFUNGUZI-60-TOFAUTI"; TOF=2910
# (fj) akaunti ZOTE za benki/simu (hakuna inayozimwa): zinazotumika (fe) NMB 1021, Selcom 1023, M-Pesa 1030, Tigo 1031 - lazima
# zitajwe; CRDB 1020, NBC 1022, PCB 1024, Halopesa 1032, Airtel 1033 - haijatajwa = 0 (ripoti inaorodhesha zote)
ACC=(1021 1023 1030 1031 1020 1022 1024 1032 1033); NAME=(NMB SELCOM MPESA TIGO CRDB NBC PCB HALOPESA AIRTEL)
num() { [[ "${1:-}" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; }
LIVE="e.status='POSTED' and not coalesce(e.is_deleted,false)"
# salio la GL KABLA ya D (entry_date < D)
bal() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
   where l.account_code='$1' and $LIVE and e.entry_date < date '$D'"; }
tb() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where $LIVE"; }
calc() { q "select ($1)::numeric(19,2)"; }
cond() { q "select ($1)"; }
cutover() { q "select coalesce((select bank_cutover_date::text from gl_config order by id limit 1),'')"; }
period() { q "select coalesce((select status from gl_period where branch_uid is null and period_year=extract(year from date '$D') and period_month=extract(month from date '$D') limit 1),'OPEN')"; }
# journal ya alama (reference_number = memo): idadi | mistari "akaunti:Dr-Cr"
mj() { q "select count(distinct e.uid)||' | '||coalesce((select string_agg(x, ',' order by x) from (select l.account_code||':'||sum(l.debit_amount-l.credit_amount)::numeric(19,2) x
   from journal_entry_line l join journal_entry e2 on e2.uid=l.journal_entry_uid where e2.reference_number='$1' and e2.status='POSTED' and not coalesce(e2.is_deleted,false)
   group by l.account_code having sum(l.debit_amount-l.credit_amount) <> 0) y),'') from journal_entry e where e.reference_number='$1' and $LIVE"; }

[ "$MODE" = kagua ] || [ "$MODE" = andika ] || { echo "MATUMIZI: $0 kagua | andika   (env L60_D, L60_NMB, L60_SELCOM, L60_MPESA, L60_TIGO, L60_TASLIMU, L60_BAHASHA)"; exit 2; }
echo "=== 60 $(echo "$MODE" | tr a-z A-Z) $(date '+%F %T')"
[[ "$D" =~ ^20[0-9]{2}-[01][0-9]-[0-3][0-9]$ ]] && date -d "$D" +%F >/dev/null 2>&1 || die "L60_D si tarehe YYYY-MM-DD ([$D])"
V=("${L60_NMB:-}" "${L60_SELCOM:-}" "${L60_MPESA:-}" "${L60_TIGO:-}" "${L60_CRDB:-0}" "${L60_NBC:-0}" "${L60_PCB:-0}" "${L60_HALOPESA:-0}" "${L60_AIRTEL:-0}")
for i in "${!ACC[@]}"; do num "${V[$i]}" || die "L60_${NAME[$i]} si kiasi halali ([${V[$i]}]) - salio la taarifa, bila koma"; done
num "${L60_TASLIMU:-}" || die "L60_TASLIMU si kiasi halali ([${L60_TASLIMU:-}]) - pesa taslimu yote (droo + sefu + bahasha)"
BAH="${L60_BAHASHA:-0}"; num "$BAH" || die "L60_BAHASHA si kiasi halali ([$BAH])"
[ "$(cond "$BAH <= ${L60_TASLIMU}")" = t ] || die "BAHASHA ($BAH) > TASLIMU (${L60_TASLIMU}) - bahasha ni sehemu ya pesa taslimu"

CUR=$(cutover); PER=$(period); T0=$(tb)
echo "D: $D   leo: $TODAY   cutover sasa: ${CUR:-HAIJAWEKWA}   kipindi cha D: $PER   TB: $T0"
echo "--- salio la GL kabla ya D (entry_date < $D) -> salio halisi -> journal (akaunti ZOTE ${#ACC[@]} za benki/simu)"
SUM=0; LINES=""; DESC=""
for i in "${!ACC[@]}"; do
  a=${ACC[$i]}; b=$(bal "$a"); delta=$(calc "${V[$i]} - $b")
  echo "  $a ${NAME[$i]}: GL $b -> halisi ${V[$i]} -> journal $delta"
  SUM=$(calc "$SUM + $delta")
  case "$(cond "sign($delta)::int")" in
    1)  LINES="$LINES{\"accountCode\":\"$a\",\"debit\":$delta,\"credit\":0,\"description\":\"Ufunguzi D $D: salio halisi la ${NAME[$i]} (taarifa) - lilikuwa ndani ya 1000\"},";;
    -1) LINES="$LINES{\"accountCode\":\"$a\",\"debit\":0,\"credit\":$(calc "-($delta)"),\"description\":\"Ufunguzi D $D: salio halisi la ${NAME[$i]} (taarifa) - ziada ya GL inarudi 1000\"},";;
  esac
done
B1000=$(bal 1000); AFTER=$(calc "$B1000 - $SUM"); DIFF=$(calc "${L60_TASLIMU} - $AFTER")
case "$(cond "sign($SUM)::int")" in
  1)  LINES="$LINES{\"accountCode\":\"1000\",\"debit\":0,\"credit\":$SUM,\"description\":\"Ufunguzi D $D: benki/simu zinatoka 1000 (kabla ya D zilikuwa ndani ya 1000)\"}";;
  -1) LINES="$LINES{\"accountCode\":\"1000\",\"debit\":$(calc "-($SUM)"),\"credit\":0,\"description\":\"Ufunguzi D $D: benki/simu zinarudi 1000\"}";;
  *)  LINES="${LINES%,}";;
esac
echo "  1000 pesa taslimu: GL $B1000 -> baada ya journal $AFTER -> halisi ${L60_TASLIMU} (bahasha $BAH ndani yake)"
echo "TOFAUTI_YA_UFUNGUZI $DIFF   (halisi - vitabu; + = pesa nyingi kuliko vitabu)"
TACT=$(q "select count(*) from gl_account where account_code='$TOF' and is_active")
if [ "$(cond "$DIFF <> 0")" = t ]; then
  echo "  -> journal ya pili $MARKT: 1000 / $TOF Tofauti ya ufunguzi (akaunti ya muda; chambua ndani ya siku 30)"
  [ "$TACT" = 1 ] || echo "  SIYO: akaunti $TOF haipo (toleo 2 / V150 halijafika?) - ANDIKA itakataa"
fi
CODES=$(printf "'%s'," "${ACC[@]}"); CODES=${CODES%,}
NACT=$(q "select count(*) from gl_account where account_code in ('1000',$CODES) and is_active")
echo "--- akaunti za pesa zilizo wazi: $NACT / $(( ${#ACC[@]} + 1 ))   (fj: zote zinabaki wazi)"
echo "  1010 (Petty Cash Float): $(bal 1010)   (6d haijajengwa: bahasha ni sehemu ya 1000)"
echo "--- journal za siku D au baadaye zinazogusa pesa (zisizo mauzo) - lazima 0 kabla ya kuweka D:"
AFT="e.entry_date >= date '$D' and $LIVE and e.reference_type not like 'SALE%' and coalesce(e.reference_number,'') not in ('$MARK','$MARKT')
   and exists (select 1 from journal_entry_line l where l.journal_entry_uid=e.uid and (l.account_code='1000' or l.account_code like '102%' or l.account_code like '103%'))"
q "select '  '||e.entry_date||' '||e.reference_type||' '||coalesce(e.entry_number,'') from journal_entry e where $AFT order by e.entry_date limit 20"
NAFT=$(q "select count(*) from journal_entry e where $AFT"); echo "  idadi: $NAFT"
J1=$(mj "$MARK"); J2=$(mj "$MARKT"); echo "journal ya ufunguzi tayari: $J1   ya tofauti: $J2"

if [ "$MODE" = kagua ]; then
  echo "---60_KAGUA_MWISHO---"; exit 0
fi

IFS= read -r EMAIL || true; IFS= read -r PASS || true; EMAIL=${EMAIL%$'\r'}; PASS=${PASS%$'\r'}
[ -n "$EMAIL" ] && [ -n "$PASS" ] || die "email/password tupu"
[ "$D" = "$TODAY" ] || die "D ($D) lazima iwe LEO ($TODAY): journal haiwezi kuwa ya baadaye, na D ya zamani ingeacha reco/malipo ya katikati bila kuhamishwa"
[ -z "$CUR" ] || [ "$CUR" = "$D" ] || die "cutover tayari ni $CUR (si $D) - haibadilishwi"
[ "$PER" = CLOSED ] || [ "$PER" = LOCKED ] && die "mwezi wa D umefungwa ($PER)"
[ "$NAFT" = 0 ] || die "kuna journal $NAFT za pesa za siku D au baadaye (zisizo mauzo) - zingeandikwa kwa kanuni ya kabla ya D"
[ "$TACT" = 1 ] || die "akaunti $TOF Tofauti ya ufunguzi haipo au haitumiki (V150 ya toleo 2) - HAKUNA kilichoandikwa"
[ "$NACT" = $(( ${#ACC[@]} + 1 )) ] || die "akaunti ya pesa haipo au imezimwa ($NACT / $(( ${#ACC[@]} + 1 ))) - (fj) zote lazima ziwe wazi"

jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
api() { HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X POST -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' ${TOKEN:+-H "Authorization: Bearer $TOKEN"} --data "$2" "$BASE$1"); }
okb() { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg() { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 300; }
TOKEN=; api /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"; PASS=
TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); [ -n "$TOKEN" ] || die "login HTTP $HC $(msg)"; echo "login SAWA"

# 1. journal ya ufunguzi (uhamisho kutoka 1000; TB haibadiliki)
if [ "${J1%% *}" != 0 ]; then
  echo "journal ya ufunguzi IPO TAYARI ($J1) - inarukwa"
elif [ "$(cond "$SUM = 0")" = t ] && ! [[ "$LINES" == *accountCode* ]]; then
  echo "journal ya ufunguzi: hakuna cha kuandika (GL tayari = salio halisi)"
else
  api /api/v1/gl/journal-entries/manual "{\"entryDate\":\"$D\",\"memo\":\"$MARK\",\"lines\":[$LINES]}"
  okb || die "journal ya ufunguzi HTTP $HC $(msg) - HAKUNA kilichoandikwa, D haijawekwa"
  echo "journal ya ufunguzi SAWA: $(sed -n 's/.*"data" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1)"
fi
# 2. tofauti ya ufunguzi (journal ya pili, WAZI) -> 2910 akaunti ya muda (fg)
if [ "$(cond "$DIFF <> 0")" = t ]; then
  if [ "${J2%% *}" != 0 ]; then echo "journal ya tofauti IPO TAYARI ($J2) - inarukwa"
  else
    A=$(calc "abs($DIFF)"); W="Tofauti ya ufunguzi D $D: pesa taslimu halisi ${L60_TASLIMU} dhidi ya vitabu $AFTER - ya muda, chambua ndani ya siku 30"
    if [ "$(cond "$DIFF > 0")" = t ]; then L2="{\"accountCode\":\"1000\",\"debit\":$A,\"credit\":0,\"description\":\"$W\"},{\"accountCode\":\"$TOF\",\"debit\":0,\"credit\":$A,\"description\":\"$W\"}"
    else L2="{\"accountCode\":\"$TOF\",\"debit\":$A,\"credit\":0,\"description\":\"$W\"},{\"accountCode\":\"1000\",\"debit\":0,\"credit\":$A,\"description\":\"$W\"}"; fi
    api /api/v1/gl/journal-entries/manual "{\"entryDate\":\"$D\",\"memo\":\"$MARKT\",\"lines\":[$L2]}"
    okb || die "journal ya tofauti HTTP $HC $(msg) - ufunguzi umeandikwa, D HAIJAWEKWA: rekebisha kisha endesha tena (ufunguzi utarukwa)"
    echo "journal ya tofauti SAWA"
  fi
fi
# 3. kuhakiki kabla ya D: kila akaunti (kabla ya D + journal za ufunguzi) = halisi
for i in "${!ACC[@]}"; do
  a=${ACC[$i]}
  got=$(q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
     where l.account_code='$a' and $LIVE and (e.entry_date < date '$D' or e.reference_number in ('$MARK','$MARKT'))")
  [ "$(cond "$got = ${V[$i]}")" = t ] || die "$a ${NAME[$i]} = $got baada ya ufunguzi (lazima ${V[$i]}) - D HAIJAWEKWA, nitumie log"
done
C1=$(q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
   where l.account_code='1000' and $LIVE and (e.entry_date < date '$D' or e.reference_number in ('$MARK','$MARKT'))")
[ "$(cond "$C1 = ${L60_TASLIMU}")" = t ] || die "1000 = $C1 baada ya ufunguzi (lazima taslimu ${L60_TASLIMU}) - D HAIJAWEKWA, nitumie log"
[ "$(tb)" = "$T0" ] || die "TB imebadilika ($T0 -> $(tb)) - D HAIJAWEKWA"
# 4. D (kinga za 60-bank-cutover.sql: malipo ya mkopo, mwezi uliofungwa, D isiyobadilika; transaction moja)
[ -s "$SQLF" ] || die "$SQLF haipo - ufunguzi umeandikwa, D HAIJAWEKWA"
docker compose -p "$PROJ" exec -T -e "D=$D" postgres sh -c 'psql -X -q -At -v ON_ERROR_STOP=1 -v D="$D" -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$SQLF" > "$T/d" 2>&1
RC=$?; sed 's/^/  /' "$T/d"
[ "$RC" = 0 ] && grep -qx "CUTOVER_SASA $D" "$T/d" || die "kuweka D kumeshindwa (psql $RC) - ufunguzi umeandikwa; endesha tena baada ya kurekebisha (ufunguzi utarukwa)"
echo "--- BAADA"
for i in "${!ACC[@]}"; do echo "  ${ACC[$i]} ${NAME[$i]}: ${V[$i]}"; done
echo "  1000: $(q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
     where l.account_code='1000' and $LIVE and (e.entry_date < date '$D' or e.reference_number in ('$MARK','$MARKT'))")   (taslimu halisi ${L60_TASLIMU})"
[ "$(cond "$DIFF <> 0")" = t ] && echo "  $TOF Tofauti ya ufunguzi: $DIFF (+ = Cr, pesa nyingi) - chambua kabla ya $(date -d "$D +30 days" +%F); kisichoelezeka -> 3900 (CEO + taarifa kwa Executive CEO)"
echo "  TB: $(tb)   cutover: $(cutover)"
echo "---60_MWISHO---"
