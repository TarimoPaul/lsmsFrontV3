#!/usr/bin/env bash
# HATUA 88 (mmiliki 11/11 ex/ey) - PROD: row ya capex OPE-MON-20260101-000000-2939F6DE (maelezo "2400000", 200,000, Jan 2026)
# ina journal POSTED Dr 6200 200,000 / Cr 1000 200,000 tarehe 01/01. Hatua 80 ilitafuta Frame kwa jina ('frame'),
# kwa hiyo row hii HAIKUONEKANA. Chief 11/11 (ez): ni Frame mara ya 2 (iliandikwa 30/04), haikutoka kwenye biashara:
#   Dr 1000 200,000 / Cr 6200 200,000, tarehe = siku ya kuandika (Novemba), sawa na 80b (Cr 1000 ya Frame iliyorudishwa).
#   Row ya capex HAIFUTWI (GL ya 80 ingevurugika); itawekewa alama exclude_from_ops_report kwenye toleo 2 (ew).
#   bash 88-frame-jan-ya-tatu.sh kagua    KUSOMA TU: row + journal yake, Frame zote za 2026, watoto wa Sep "wafanyakazi", salio
#   bash 88-frame-jan-ya-tatu.sh andika   stdin = email, password ya CEO (FINANCE_WRITE) -> journal ya mkono
# Kinga: row lazima iwe vilevile (amount 200,000, journal 1 POSTED 1000:-200000 / 6200:200000); kipindi cha leo kisifungwe;
#   KABLA ya cutover D; ikiwa journal ya 88 ipo tayari -> HAKUNA kinachoandikwa. Baada: TB 0, 1000 +200,000, 6200 -200,000.
# Maandishi yote ni ASCII (somo la 83/84).
set -uo pipefail
MODE="${1:-}"
H="${L88_HOME:-$HOME}"
DIR="${L88_DIR:-$H/lsms-deployment}"; PROJ="${L88_PROJ:-lsms-deployment}"; BASE="${L88_BASE:-http://localhost}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---88_IMESHINDWA---"; exit 1; }
TODAY="${L88_TODAY:-$(date +%F)}"
MARK="MAREKEBISHO-88-FRAME-JAN"
REFNO="OPE-MON-20260101-000000-2939F6DE"
DESC="Marekebisho: Frame Jan 2026 mara ya 2 (row 2400000 ya 30/04, ${REFNO}) haikutoka kwenye biashara (hatua 88, Chief 11/11)"
AMT=200000
dc() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
   where l.account_code='$1' and e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
tb() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
bal26() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
   where l.account_code='$1' and e.status='POSTED' and not coalesce(e.is_deleted,false) and e.entry_date >= '2026-01-01' and e.entry_date < '2027-01-01'"; }
salio() { echo "1000 (Dr-Cr): $(dc 1000) | 6200 2026: $(bal26 6200) | 6000 2026: $(bal26 6000) | TB: $(tb)"; }
# (ez) pango 2026: 6000 (2026) + 6200 ya Frame (journal za rows F7C9E331 / 2939F6DE na marekebisho 80B / 88). Lengo baada ya 88:
#   6000 = 2,200,000 (2,400,000 baada ya 80e 01/12) na 6200 ya Frame = 0 (6200 haina pango).
FRAME6200="e.reference_uid in (select uid from capital_expenditure where reference_number in ('OPE-MON-20260101-000000-F7C9E331','$REFNO'))
   or e.reference_number in ('MAREKEBISHO-80B','$MARK')"
pango() { echo "PANGO 2026: 6000 = $(bal26 6000) | 6200 ya Frame = $(q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2)
   from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code='6200' and e.status='POSTED' and not coalesce(e.is_deleted,false) and ($FRAME6200)")"; }
# the row's own journal(s): count | Cr 1000 | Dr 6200 (POSTED, not deleted, not reversed)
rowj() { q "select count(distinct e.uid)||' | '||coalesce(sum(coalesce(l.credit_amount,0)-coalesce(l.debit_amount,0)) filter (where l.account_code='1000'),0)::numeric(19,0)||' | '||coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)) filter (where l.account_code='6200'),0)::numeric(19,0)
   from capital_expenditure c join journal_entry e on e.reference_uid=c.uid join journal_entry_line l on l.journal_entry_uid=e.uid
   where c.reference_number='$REFNO' and e.status='POSTED' and not coalesce(e.is_deleted,false)
     and not exists (select 1 from journal_entry r where r.reversed_entry_uid=e.uid and not coalesce(r.is_deleted,false))"; }
rowc() { q "select coalesce((select amount::numeric(19,0)||' | '||description||' | '||status from capital_expenditure where reference_number='$REFNO' and not coalesce(is_deleted,false)),'HAIPO')"; }
done88() { q "select count(*) from journal_entry where reference_number = '$MARK' and not coalesce(is_deleted,false)"; }
cutover() { q "select coalesce((select bank_cutover_date::text from gl_config order by id limit 1),'')"; }
period() { q "select coalesce((select status from gl_period where period_year=extract(year from date '$TODAY') and period_month=extract(month from date '$TODAY')),'OPEN')"; }
jl() { echo "coalesce((select string_agg(e.entry_date||' '||e.status||' '||coalesce(e.entry_number,'')||' ['||(select string_agg(l.account_code||':'||(l.debit_amount-l.credit_amount)::numeric(19,0), ',' order by l.account_code) from journal_entry_line l where l.journal_entry_uid=e.uid)||'] (journal '||to_char(e.created_at,'YYYY-MM-DD HH24:MI')||')', ' ; ') from journal_entry e where e.reference_uid=c.uid and not coalesce(e.is_deleted,false)),'HAKUNA JOURNAL')"; }

if [ "$MODE" = kagua ]; then
  echo "=== 88 KAGUA $(date '+%F %T') - KUSOMA TU"
  echo "--- (ey) row: ref | maelezo | kiasi | hali | tarehe | iliundwa | created_by | approved_by | updated_by | journal"
  q "select c.reference_number, c.description, c.amount::numeric(19,0), c.status, c.transaction_date::date, to_char(c.created_at,'YYYY-MM-DD HH24:MI'),
            coalesce(c.created_by,'-'), coalesce(c.approved_by,'-'), coalesce(c.updated_by,'-'), $(jl)
     from capital_expenditure c where c.reference_number='$REFNO'"
  echo "--- aliyeiunda kwenye audit_trails (dakika 2 kabla/baada ya kuundwa):"
  q "select a.\"timestamp\"::timestamp(0)||' | '||coalesce(a.user_email,'-')||' | '||coalesce(a.action,'-')||' | '||coalesce(a.endpoint,'-') from audit_trails a, capital_expenditure c
     where c.reference_number='$REFNO' and a.\"timestamp\" between c.created_at - interval '2 minutes' and c.created_at + interval '2 minutes' order by 1 limit 20"
  echo "   (tupu = hakuna rekodi; nakala ya 29/10 ilikuwa tupu, created_by tupu)"
  echo "--- Frame + rows za 200,000 za Jan 2026 (kwa kulinganisha): ref | maelezo | kiasi | iliundwa | journal"
  q "select c.reference_number, c.description, c.amount::numeric(19,0), to_char(c.created_at,'YYYY-MM-DD HH24:MI'), $(jl)
     from capital_expenditure c where not coalesce(c.is_deleted,false) and c.transaction_date >= '2026-01-01' and c.transaction_date < '2027-01-01'
       and ((c.description ilike '%frame%' and c.description not ilike '%usafi%') or c.reference_number='$REFNO'
            or (c.amount = 200000 and c.transaction_date < '2026-02-01')) order by c.transaction_date, c.id"
  echo "--- (ey) Septemba 'wafanyakazi' (Chief athibitishe kama ni nakala): ref | maelezo | kiasi | iliundwa | journal"
  q "select c.reference_number, c.description, c.amount::numeric(19,0), to_char(c.created_at,'YYYY-MM-DD HH24:MI'), $(jl)
     from capital_expenditure c where not coalesce(c.is_deleted,false) and c.transaction_date >= '2026-08-01' and c.transaction_date < '2026-10-01'
       and (c.description ilike '%fanyakazi%' or c.description ilike '%manager%') order by c.transaction_date, c.id"
  echo "row: $(rowc)   (lazima 200000 | 2400000 | APPROVED)"
  echo "journal ya row: $(rowj)   (lazima 1 | 200000 | 200000)"
  c=$(cutover); echo "cutover D: ${c:-HAIJAWEKWA}   kipindi $TODAY: $(period)   journal ya 88 tayari: $(done88)"
  echo "--- salio SASA"; salio; pango
  echo "journal itakuwa (tarehe $TODAY), Chief 11/11 (ez) = Frame mara ya 2: Dr 1000 200,000 / Cr 6200 200,000 - '$DESC'"
  echo "makadirio BAADA: 1000 = $(q "select ($(dc 1000))::numeric + $AMT"), 6200 2026 = $(q "select ($(bal26 6200))::numeric - $AMT"), TB haibadiliki"
  echo "lengo (ez) BAADA: 6000 2026 = 2,200,000 (2,400,000 baada ya 80e) na 6200 ya Frame = 0"
  echo "---88_KAGUA_MWISHO---"; exit 0
fi
[ "$MODE" = andika ] || { echo "MATUMIZI: $0 kagua | andika"; exit 2; }
IFS= read -r EMAIL || true; IFS= read -r PASS || true; EMAIL=${EMAIL%$'\r'}; PASS=${PASS%$'\r'}
[ -n "$EMAIL" ] && [ -n "$PASS" ] || die "email/password tupu"
echo "=== 88 ANDIKA $(date '+%F %T')"
[ "$(done88)" = 0 ] || die "journal ya 88 ($MARK) IPO TAYARI - hakuna kinachoandikwa mara ya pili"
c=$(cutover); [ -z "$c" ] || [[ "$TODAY" < "$c" ]] || die "cutover D ($c) imeshafika - muulize Chief"
[ "$(period)" != CLOSED ] || die "kipindi cha $TODAY kimefungwa"
[ "$(rowc)" = "200000 | 2400000 | APPROVED" ] || die "row: $(rowc) (lazima 200000 | 2400000 | APPROVED) - hali imebadilika, HAKUNA kilichoandikwa"
[ "$(rowj)" = "1 | 200000 | 200000" ] || die "journal ya row: $(rowj) (lazima 1 | 200000 | 200000) - hali imebadilika, HAKUNA kilichoandikwa"
[ "$(q "select count(*) from gl_account where account_code in ('1000','6200') and is_active")" = 2 ] || die "akaunti 1000/6200 haipo au haitumiki"
echo "--- salio KABLA"; salio; C0=$(dc 1000); E0=$(dc 6200); T0=$(tb)
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
api() { HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X POST -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' ${TOKEN:+-H "Authorization: Bearer $TOKEN"} --data "$2" "$BASE$1"); }
okb() { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg() { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 300; }
TOKEN=; api /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"; PASS=
TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); [ -n "$TOKEN" ] || die "login HTTP $HC $(msg)"; echo "login SAWA"
api /api/v1/gl/journal-entries/manual "{\"entryDate\":\"$TODAY\",\"memo\":\"$MARK\",\"lines\":[{\"accountCode\":\"1000\",\"debit\":$AMT,\"credit\":0,\"description\":\"$(jesc "$DESC")\"},{\"accountCode\":\"6200\",\"debit\":0,\"credit\":$AMT,\"description\":\"$(jesc "$DESC")\"}]}"
okb || die "journal ya mkono HTTP $HC $(msg)"
REF=$(sed -n 's/.*"data" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); echo "journal SAWA: $REF"
q "select e.entry_number, e.entry_date, e.status, e.reference_number, l.account_code, l.debit_amount, l.credit_amount, l.description from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_uid='$REF' order by l.line_order"
echo "--- salio BAADA"; salio; pango
[ "$(tb)" = "$T0" ] || die "TB imebadilika ($T0 -> $(tb))"
[ "$(q "select ($(dc 1000))::numeric = ($C0)::numeric + $AMT and ($(dc 6200))::numeric = ($E0)::numeric - $AMT")" = t ] || die "salio 1000/6200 halikubadilika kwa 200,000 kama ilivyotarajiwa"
F62=$(q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
   where l.account_code='6200' and e.status='POSTED' and not coalesce(e.is_deleted,false) and ($FRAME6200)")
P60=$(bal26 6000)
[ "$F62" = "0.00" ] && echo "SAWA (ez): 6200 haina pango" || echo "ANGALIA (ez): 6200 ya Frame = $F62 (lengo 0) - nitumie log"
[ "$P60" = "2200000.00" ] || [ "$P60" = "2400000.00" ] && echo "SAWA (ez): 6000 2026 = $P60" || echo "ANGALIA (ez): 6000 2026 = $P60 (lengo 2,200,000; 2,400,000 baada ya 80e) - nitumie log"
echo "---88_MWISHO---"
