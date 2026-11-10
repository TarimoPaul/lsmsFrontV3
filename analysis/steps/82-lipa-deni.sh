#!/usr/bin/env bash
# HATUA 82 (mmiliki 10/11 eb) - PROD, YA DHARURA: kulipa deni la gharama 2400 (pango la Frame ~600,000 ~01/01/27) au
# 2200 (TRA 65,000) BILA kuandika gharama mpya: Dr 2400/2200 / Cr chanzo (kanuni ya cutover ya C3).
# ITUMIKE TU ikiwa malipo hayo yatafanyika KABLA toleo 2 (skrini "Madeni ya gharama", V141) halijaenda prod.
#   bash 82-lipa-deni.sh kagua                 KUSOMA TU: salio la 2400/2200, tarehe ya cutover, vipindi, journal za 82 zilizopo
#   bash 82-lipa-deni.sh angalia               KUSOMA TU: stdin = akaunti, kiasi, chanzo, akaunti_ya_chanzo, maelezo -> journal itakavyokuwa
#   bash 82-lipa-deni.sh andika                stdin = (vilevile 5) + email + password ya CEO (FINANCE_WRITE) -> journal ya mkono
# Chanzo: DROO -> 1000 | BENKI 1020..1024 | SIMU 1030..1033 | MMILIKI -> 2300 (deni kwa mmiliki).
#   Kabla ya gl_config.bank_cutover_date (au ikiwa haijawekwa): DROO/BENKI/SIMU zote -> Cr 1000.
# Kinga: kiasi <= salio la deni; tarehe = leo (kipindi kisifungwe); maelezo >= herufi 10 na si takataka;
#   alama "DENI82-<akaunti>-<tarehe>-<kiasi>" -> ikiwepo tayari, HAKUNA kinachoandikwa mara ya pili.
# Reco ya droo haiguswi (kama malipo ya C3 ya wasambazaji). Toleo 2 likifika, salio la 2400/2200 linasomwa kutoka GL,
# kwa hiyo malipo haya yanaonekana humo bila hatua nyingine.
set -uo pipefail
MODE="${1:-}"
H="${L82_HOME:-$HOME}"
DIR="${L82_DIR:-$H/lsms-deployment}"; PROJ="${L82_PROJ:-lsms-deployment}"; BASE="${L82_BASE:-http://localhost}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---82_IMESHINDWA---"; exit 1; }
TODAY="${L82_TODAY:-$(date +%F)}"
bal() { q "select coalesce(sum(coalesce(l.credit_amount,0)-coalesce(l.debit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
   where l.account_code='$1' and e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
tb() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
cutover() { q "select coalesce((select bank_cutover_date::text from gl_config order by id limit 1),'')"; }
salio() {
  echo "2400 Gharama zinazodaiwa: $(bal 2400)   2200 Kodi zinazodaiwa: $(bal 2200)   (Cr - Dr)"
  echo "TB (Dr - Cr, zote POSTED): $(tb)"
}

if [ "$MODE" = kagua ]; then
  echo "=== 82 KAGUA $(date '+%F %T') - KUSOMA TU"
  echo "!!! Hatua ya DHARURA: itumike TU ikiwa pango (2400) au TRA (2200) linalipwa KABLA toleo 2 halijaenda prod."
  echo "--- akaunti:"; q "select account_code, account_name, account_type, is_active from gl_account where account_code in ('1000','1020','1021','1022','1023','1024','1030','1031','1032','1033','2200','2300','2400') order by 1"
  echo "--- salio:"; salio
  c=$(cutover); echo "--- cutover ya benki (gl_config.bank_cutover_date): ${c:-HAIJAWEKWA} -> leo ($TODAY) BENKI/SIMU = $( [ -n "$c" ] && [[ ! "$TODAY" < "$c" ]] && echo 'akaunti halisi 102x/103x' || echo 'Cr 1000')"
  echo "--- kipindi cha leo: $(q "select coalesce((select status from gl_period where period_year=extract(year from date '$TODAY') and period_month=extract(month from date '$TODAY')),'OPEN (hakuna row)')")"
  echo "--- journal za 82 zilizopo:"; q "select e.entry_number, e.entry_date, e.status, e.reference_number from journal_entry e where e.reference_number like 'DENI82-%' order by e.id"
  echo "---82_KAGUA_MWISHO---"; exit 0
fi

[ "$MODE" = angalia ] || [ "$MODE" = andika ] || { echo "MATUMIZI: $0 kagua | angalia | andika   (angalia/andika: stdin)"; exit 2; }
rd() { IFS= read -r v || true; v=${v%$'\r'}; printf '%s' "$v"; }
ACC=$(rd); AMT=$(rd); SRC=$(rd); SACC=$(rd); DESC=$(rd)
SRC=$(printf '%s' "$SRC" | tr '[:lower:]' '[:upper:]'); SACC=$(printf '%s' "$SACC" | tr -d ' ')
DESC=$(printf '%s' "$DESC" | sed 's/^ *//; s/ *$//')
echo "=== 82 ${MODE^^} $(date '+%F %T')"
echo "ombi: akaunti=$ACC kiasi=$AMT chanzo=$SRC akaunti_ya_chanzo=${SACC:--} maelezo='$DESC' tarehe=$TODAY"
case "$ACC" in 2400|2200) ;; *) die "akaunti lazima iwe 2400 (gharama zinazodaiwa) au 2200 (kodi zinazodaiwa), si '$ACC'";; esac
[[ "$AMT" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]] || die "kiasi '$AMT' si sahihi (namba, senti 2 tu, bila koma)"
[ "$(q "select ($AMT)::numeric > 0")" = t ] || die "kiasi lazima kiwe zaidi ya sifuri"
case "$SRC" in
  DROO|MMILIKI) [ -z "$SACC" ] || die "$SRC haichukui akaunti (umeandika '$SACC')";;
  BENKI) [[ "$SACC" =~ ^102[0-4]$ ]] || die "BENKI inahitaji akaunti 1020..1024 (CRDB 1020, NMB 1021, NBC 1022, Selcom 1023, PCB 1024)";;
  SIMU) [[ "$SACC" =~ ^103[0-3]$ ]] || die "SIMU inahitaji akaunti 1030..1033 (M-Pesa 1030, Tigo 1031, Halopesa 1032, Airtel 1033)";;
  *) die "chanzo lazima kiwe DROO, BENKI, SIMU au MMILIKI";;
esac
[ "${#DESC}" -ge 10 ] || die "maelezo yanahitajika (angalau herufi 10)"
DISTINCT=$(printf '%s' "$DESC" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9' | fold -w1 | sort -u | wc -l)
[ "$DISTINCT" -ge 4 ] || die "maelezo hayaeleweki (herufi tofauti chini ya 4) - eleza malipo kwa maneno"
case "$DESC" in *'"'*|*\\*) die "maelezo yasiwe na \" wala \\";; esac
C=$(cutover)
if [ "$SRC" = MMILIKI ]; then CR=2300
elif [ "$SRC" = DROO ] || [ -z "$C" ] || [[ "$TODAY" < "$C" ]]; then CR=1000
else CR=$SACC; fi
[ "$(q "select count(*) from gl_account where account_code='$ACC' and is_active")" = 1 ] || die "akaunti ya deni $ACC haipo kwenye chart (2400 inaongezwa na hatua 80b) - HAKUNA kilichoandikwa"
[ "$(q "select count(*) from gl_account where account_code='$CR' and is_active")" = 1 ] || die "akaunti ya kutoa pesa $CR haipo au haitumiki"
[ "$(q "select coalesce((select status from gl_period where period_year=extract(year from date '$TODAY') and period_month=extract(month from date '$TODAY')),'OPEN')")" != CLOSED ] || die "kipindi cha $TODAY kimefungwa"
MARK="DENI82-$ACC-${TODAY//-/}-$AMT"
# alama kwanza: malipo yaliyokwisha andikwa yanatambuliwa kabla ya ukaguzi wa salio (salio limeshapungua)
if [ "$(q "select count(*) from journal_entry where reference_number = '$MARK' and not coalesce(is_deleted,false)")" != 0 ]; then
  echo "TAYARI IPO: journal yenye alama $MARK imeshaandikwa - HAKUNA kitakachoandikwa mara ya pili."
  q "select e.entry_number, e.entry_date, e.status, l.account_code, l.debit_amount, l.credit_amount from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_number = '$MARK' order by e.id, l.line_order"
  echo "---82_MWISHO---"; exit 0
fi
OWED=$(bal "$ACC")
[ "$(q "select ($AMT)::numeric <= ($OWED)::numeric")" = t ] || die "kiasi $AMT kinazidi deni lililopo la $ACC ($OWED) - HAKUNA kilichoandikwa"
echo "cutover: ${C:-haijawekwa} -> Cr $CR"
echo "journal itakuwa (tarehe $TODAY, alama $MARK):"
echo "   Dr $ACC $AMT   (deni linapungua: $OWED -> $(q "select ($OWED)::numeric - ($AMT)::numeric"))"
echo "   Cr $CR $AMT   (chanzo $SRC${SACC:+ $SACC})"
echo "   HAKUNA akaunti ya gharama (6xxx) - hii si gharama mpya."
if [ "$MODE" = angalia ]; then echo "--- salio sasa"; salio; echo "---82_ANGALIA_MWISHO---"; exit 0; fi

IFS= read -r EMAIL || true; IFS= read -r PASS || true; EMAIL=${EMAIL%$'\r'}; PASS=${PASS%$'\r'}
[ -n "$EMAIL" ] && [ -n "$PASS" ] || die "email/password tupu"
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
api() { HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X POST -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' ${TOKEN:+-H "Authorization: Bearer $TOKEN"} --data "$2" "$BASE$1"); }
okb() { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg() { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 300; }
echo "--- salio KABLA"; salio; TB0=$(tb)
TOKEN=; api /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"; PASS=
TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); [ -n "$TOKEN" ] || die "login HTTP $HC $(msg)"; echo "login SAWA"
LINE="Malipo ya deni $ACC: $DESC - $MARK"
api /api/v1/gl/journal-entries/manual "{\"entryDate\":\"$TODAY\",\"memo\":\"$MARK\",\"lines\":[{\"accountCode\":\"$ACC\",\"debit\":$AMT,\"credit\":0,\"description\":\"$(jesc "$LINE")\"},{\"accountCode\":\"$CR\",\"debit\":0,\"credit\":$AMT,\"description\":\"$(jesc "$LINE")\"}]}"
okb || die "journal ya mkono HTTP $HC $(msg)"
REF=$(sed -n 's/.*"data" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); echo "journal SAWA: $REF"
q "select e.entry_number, e.entry_date, e.status, e.reference_number, l.account_code, l.debit_amount, l.credit_amount from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_uid='$REF' order by l.line_order"
echo "--- salio BAADA"; salio
[ "$(tb)" = "$TB0" ] || die "TB imebadilika ($TB0 -> $(tb))"
[ "$(q "select ($(bal "$ACC"))::numeric = ($OWED)::numeric - ($AMT)::numeric")" = t ] || die "deni la $ACC halikupungua kwa $AMT"
echo "---82_MWISHO---"
