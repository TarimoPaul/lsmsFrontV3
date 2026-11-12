#!/usr/bin/env bash
# HATUA 74b (mmiliki 12/11 gb; 6b) - PROD, BAADA ya toleo 2: manunuzi YOTE yasiyo na msambazaji aliyesajiliwa + UNPAID -> PAID.
#   Chief (6b): yalilipwa siku ile ile. GL tayari inayahesabu kuwa yamelipwa wote (PostingEngine: hakuna msambazaji = yamelipwa
#   sasa -> Dr 1200 / Cr 1000 au chanzo). Kwa hiyo hali ya malipo TU inarekebishwa: payment_status PAID, amount_paid = total.
#   HAKUNA journal. Sheria (si orodha): supplier_uid tupu, payment_status UNPAID, amount_paid 0, status <> CANCELLED, si deleted.
#   Kila row inapangwa:
#     GL-SAWA   journal MOJA POSTED [1200:+jumla, Cr ya pesa (1000/102x/103x): -jumla]  -> inaandikwa
#     BILA-GL   PENDING (haijaidhinishwa), hakuna journal -> inaandikwa (ikiidhinishwa GL itaandika Cr kamili kama kawaida)
#     TOFAUTI   kingine chochote -> HAIGUSWI, inaorodheshwa
#   bash 74b-bila-msambazaji.sh kagua    KUSOMA TU: idadi, jumla, tarehe ya kwanza/mwisho, baada ya 28/10, kwa jina, TOFAUTI
#   bash 74b-bila-msambazaji.sh andika   SQL moja; kinga: idadi = ya kagua iliyotajwa (L74B_N); GL (TB, 1000, 1200, 2000,
#                                        idadi ya journal) haibadiliki - ikibadilika -> IMESHINDWA. ASCII tu.
set -uo pipefail
MODE="${1:-}"
H="${L74B_HOME:-$HOME}"
DIR="${L74B_DIR:-$H/lsms-deployment}"; PROJ="${L74B_PROJ:-lsms-deployment}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---74B_IMESHINDWA---"; exit 1; }
NOTE="hatua 74b (Chief 12/11 gb, 6b): bila msambazaji, ililipwa siku hiyo hiyo - GL tayari sahihi"
LIVE="e.status='POSTED' and not coalesce(e.is_deleted,false)"
BASE="(p.supplier_uid is null or p.supplier_uid = '') and p.payment_status = 'UNPAID' and coalesce(p.amount_paid,0) = 0
      and coalesce(p.status,'') <> 'CANCELLED' and not coalesce(p.is_deleted,false)"
# GL ya purchase: journal hai, mistari [akaunti:net]
GLROWS="select p.uid, p.total_amount, p.status,
          (select count(*) from journal_entry e where e.reference_uid = p.uid and $LIVE) nj,
          (select count(*) from journal_entry_line l join journal_entry e on e.uid = l.journal_entry_uid where e.reference_uid = p.uid and $LIVE
             and l.account_code = '1200' and round(l.debit_amount - l.credit_amount, 2) = round(p.total_amount, 2)) inv,
          (select count(*) from journal_entry_line l join journal_entry e on e.uid = l.journal_entry_uid where e.reference_uid = p.uid and $LIVE
             and (l.account_code = '1000' or l.account_code like '102_' or l.account_code like '103_') and round(l.credit_amount - l.debit_amount, 2) = round(p.total_amount, 2)) cash,
          (select count(*) from journal_entry_line l join journal_entry e on e.uid = l.journal_entry_uid where e.reference_uid = p.uid and $LIVE) nl
        from purchases p where $BASE"
CLASS="select uid, case when nj = 1 and nl = 2 and inv = 1 and cash = 1 then 'GL-SAWA'
                        when nj = 0 and status = 'PENDING' then 'BILA-GL' else 'TOFAUTI' end k from ($GLROWS) x"
dc() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code='$1' and $LIVE"; }
tb() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where $LIVE"; }
gl() { echo "TB $(tb) | 1000 $(dc 1000) | 1200 $(dc 1200) | 2000 $(dc 2000) | journal $(q "select count(*) from journal_entry")"; }

if [ "$MODE" = kagua ]; then
  echo "=== 74b KAGUA $(date '+%F %T') - KUSOMA TU"
  echo "--- yote (bila msambazaji + UNPAID): idadi | jumla | ya kwanza | ya mwisho | baada ya 28/10 (idadi | jumla)"
  q "select count(*), coalesce(sum(p.total_amount),0)::numeric(19,0), coalesce(min(p.purchase_date)::date::text,'-'), coalesce(max(p.purchase_date)::date::text,'-'),
            count(*) filter (where p.purchase_date >= '2026-10-29'), coalesce(sum(p.total_amount) filter (where p.purchase_date >= '2026-10-29'),0)::numeric(19,0)
     from purchases p where $BASE" | sed 's/^/  /'
  echo "--- kwa daraja: daraja | idadi | jumla"
  q "select c.k, count(*), sum(p.total_amount)::numeric(19,0) from ($CLASS) c join purchases p on p.uid = c.uid group by 1 order by 1" | sed 's/^/  /'
  echo "--- kwa jina (lililoandikwa): jina | idadi | jumla"
  q "select coalesce(nullif(trim(p.supplier_name),''),'(tupu)'), count(*), sum(p.total_amount)::numeric(19,0) from purchases p where $BASE group by 1 order by 3 desc limit 12" | sed 's/^/  /'
  echo "--- kwa mwezi: mwezi | idadi | jumla"
  q "select to_char(p.purchase_date,'YYYY-MM'), count(*), sum(p.total_amount)::numeric(19,0) from purchases p where $BASE group by 1 order by 1" | sed 's/^/  /'
  echo "--- TOFAUTI (haziguswi): uid8 | tarehe | jina | jumla | hali | journal"
  q "select left(p.uid,8), p.purchase_date::date, coalesce(p.supplier_name,'-'), p.total_amount::numeric(19,0), p.status,
            coalesce((select string_agg(l.account_code||':'||(l.debit_amount-l.credit_amount)::numeric(19,0), ',' order by l.account_code) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.reference_uid=p.uid and $LIVE),'HAKUNA GL')
     from ($CLASS) c join purchases p on p.uid = c.uid where c.k = 'TOFAUTI' order by 2 limit 30" | sed 's/^/  /'
  echo "  YA_KUANDIKA $(q "select count(*) from ($CLASS) c where c.k <> 'TOFAUTI'")"
  echo "--- GL sasa: $(gl)"
  echo "ANDIKA: PAID / amount_paid = jumla kwa GL-SAWA + BILA-GL, maelezo '$NOTE'. Hakuna journal. GL haibadiliki."
  echo "---74B_KAGUA_MWISHO---"; exit 0
fi
[ "$MODE" = andika ] || { echo "MATUMIZI: $0 kagua | andika"; exit 2; }
echo "=== 74b ANDIKA $(date '+%F %T')"
WANT="${L74B_N:-}"
[ -n "$WANT" ] || die "L74B_N (YA_KUANDIKA ya kagua) haijatajwa"
HAVE=$(q "select count(*) from ($CLASS) c where c.k <> 'TOFAUTI'")
[ "$HAVE" = "$WANT" ] || die "YA_KUANDIKA sasa $HAVE, kagua ilisema $WANT - kagua tena - HAKUNA kilichoandikwa"
[ "$HAVE" != 0 ] || { echo "hakuna cha kuandika"; echo "---74B_MWISHO---"; exit 0; }
G0=$(gl); echo "--- GL KABLA: $G0"
N=$(q "update purchases set payment_status='PAID', amount_paid=total_amount,
         purchase_notes = trim(both ' |' from coalesce(purchase_notes,'')||' | $NOTE'), updated_by='hatua-74b', updated_at=now()
       where uid in (select c.uid from ($CLASS) c where c.k <> 'TOFAUTI') returning 1" | grep -cx 1)
[ "$N" = "$WANT" ] || die "update iligusa $N badala ya $WANT"
echo "purchases $N: PAID"
G1=$(gl); echo "--- GL BAADA: $G1"
[ "$G1" = "$G0" ] || die "GL imebadilika ($G0 -> $G1)"
echo "  BAKI_UNPAID_BILA_MSAMBAZAJI $(q "select count(*) from purchases p where $BASE") (TOFAUTI tu)"
echo "---74B_MWISHO---"
