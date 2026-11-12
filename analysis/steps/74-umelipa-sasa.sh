#!/usr/bin/env bash
# HATUA 74 (mmiliki 04/11 ct, 11/11 fa 6a, 11/11 fc; BAADA §9) - PROD, BAADA ya toleo 2: "Umelipa sasa" iliyopotea.
#   createPurchaseEntity (kabla ya 2.4.0) ilipoteza amountPaid: ununuzi ulibaki UNPAID hata ukiwa umelipwa.
#   Chief 11/11 (fc): wasambazaji wote hulipwa SIKU HIYO HIYO (NMB), hakuna mkopo -> ununuzi hawa 18 ni PAID.
#   ANDIKA: kwa kila purchase ya orodha: payment_status PAID, amount_paid = total. HAKUNA journal mpya:
#     - GREPA WINE 02/10 75,000: GL tayari Dr 1200 / Cr 1000 (reco 01/10 droo).
#     - 17 wenye msambazaji (Jun-Okt, 743,464): GL Dr 1200 / Cr 2000; AP hiyo ililipwa na malipo ya wasambazaji yasiyounganishwa
#       na purchase (Dr 2000) - salio la 2000 ni 0. Kwa hiyo hali ya malipo tu ndiyo inarekebishwa.
#   capex PENDING inabaki (kawaida). Orodha ni ya dump 29/10; purchase iliyobadilika tangu hapo inarukwa/inasimamisha.
#   bash 74-umelipa-sasa.sh kagua     KUSOMA TU
#   bash 74-umelipa-sasa.sh andika    SQL; kinga: kila row lazima iwe UNPAID / 0 / jumla ileile / journal moja POSTED yenye
#                                     [1200:+jumla, 1000 au 2000:-jumla]; iliyokwisha PAID inarukwa; GL (TB, 1000, 1200, 2000,
#                                     idadi ya journal) haibadiliki - ikibadilika -> IMESHINDWA. ASCII tu.
set -uo pipefail
MODE="${1:-}"
H="${L74_HOME:-$HOME}"
DIR="${L74_DIR:-$H/lsms-deployment}"; PROJ="${L74_PROJ:-lsms-deployment}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---74_IMESHINDWA---"; exit 1; }
NOTE="hatua 74 (Chief 11/11 fc): Umelipa sasa ilipotea; ililipwa siku hiyo hiyo - GL tayari sahihi"
# uid:jumla:akaunti ya Cr kwenye GL
LIST="ff28729b-51f3-4495-8a5c-dad52cb1c10d:75000:1000
37c5030b-c9e5-4d98-b59b-09de485d894f:51000:2000
a197a871-abca-4046-97d0-f386ccb3dcf1:40000:2000
1208b48b-68f4-4054-ac41-f0a3ec27cb2c:20000:2000
468f9636-51dc-46ec-ad74-9c4b2502e8ca:35000:2000
3ff73576-5f53-405f-af6b-8e798293d6a5:166664:2000
d4d456ed-8a11-45bd-a372-6add8de6fef2:20000:2000
b61d6d47-d03b-4742-943f-f5162f55b546:27000:2000
9693b168-033c-421c-84c3-4052f7976bc9:50000:2000
5c50772f-1402-4b5f-870e-5fb422e9d7ee:72000:2000
61a248e3-dd09-4c8c-b1de-8cae07e6cc40:12500:2000
701b4397-f028-4c9d-b826-525135f1ac61:36600:2000
3747a9ae-c8b6-40f1-886d-7d65c7053ee4:10500:2000
90c1d79e-7bdb-4b44-a3ec-0fe62ff9c979:51000:2000
08877b03-f7c3-45e2-bdcd-96a48fa1acb2:56200:2000
1564525f-cb7a-407d-8cd1-baa4f7862403:29000:2000
c2532fba-f99e-4274-afa3-2fd0cac5f3a3:27000:2000
828cf8bf-fcc4-4422-aeb5-f197e662b539:39000:2000"
dc() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid
   where l.account_code='$1' and e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
tb() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
gl() { echo "TB $(tb) | 1000 $(dc 1000) | 1200 $(dc 1200) | 2000 $(dc 2000) | journal $(q "select count(*) from journal_entry")"; }
jl() { echo "coalesce((select string_agg('['||(select string_agg(l.account_code||':'||(l.debit_amount-l.credit_amount)::numeric(19,0), ',' order by l.account_code) from journal_entry_line l where l.journal_entry_uid=e.uid)||']', ' ; ') from journal_entry e where e.reference_uid=p.uid and e.status='POSTED' and not coalesce(e.is_deleted,false)),'HAKUNA GL')"; }
row() { q "select coalesce((select p.payment_status||' | '||p.amount_paid::numeric(19,0)||' | '||p.total_amount::numeric(19,0)||' | '||$(jl) from purchases p where p.uid='$1' and not p.is_deleted),'HAIPO')"; }
want() { local cr; [ "$3" = 1000 ] && cr="[1000:-$2,1200:$2]" || cr="[1200:$2,2000:-$2]"; echo "UNPAID | 0 | $2 | $cr"; }

if [ "$MODE" = kagua ]; then
  echo "=== 74 KAGUA $(date '+%F %T') - KUSOMA TU"
  echo "--- purchase | sasa (hali | kilicholipwa | jumla | GL) | lazima"
  n=0; sawa=0; tayari=0
  while IFS=: read -r u amt cr; do
    n=$((n+1)); r=$(row "$u"); w=$(want "$u" "$amt" "$cr")
    case "$r" in "$w") sawa=$((sawa+1)); s=SAWA ;; "PAID | $amt | $amt | "*) tayari=$((tayari+1)); s=TAYARI-PAID ;; *) s=TOFAUTI ;; esac
    echo "$u | $r | $s"
  done <<< "$LIST"
  echo "jumla $n: SAWA $sawa, TAYARI-PAID $tayari, TOFAUTI $((n-sawa-tayari)) (TOFAUTI -> ANDIKA inasimama)"
  echo "--- 2000 (Cr-Dr) yote: $(q "select coalesce(sum(l.credit_amount-l.debit_amount),0)::numeric(19,0) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code='2000' and e.status='POSTED' and not coalesce(e.is_deleted,false)")"
  echo "--- GL sasa: $(gl)"
  echo "ANDIKA: PAID / amount_paid = jumla kwa SAWA zote, maelezo '$NOTE'. Hakuna journal. GL haibadiliki."
  echo "---74_KAGUA_MWISHO---"; exit 0
fi
[ "$MODE" = andika ] || { echo "MATUMIZI: $0 kagua | andika"; exit 2; }
echo "=== 74 ANDIKA $(date '+%F %T')"
TODO=""
while IFS=: read -r u amt cr; do
  r=$(row "$u"); w=$(want "$u" "$amt" "$cr")
  case "$r" in
    "$w") TODO="$TODO $u:$amt" ;;
    "PAID | $amt | $amt | "*) echo "$u tayari PAID - inarukwa" ;;
    *) die "$u: '$r' (lazima '$w') - HAKUNA kilichoandikwa" ;;
  esac
done <<< "$LIST"
[ -n "$TODO" ] || { echo "hakuna cha kuandika"; echo "---74_MWISHO---"; exit 0; }
G0=$(gl); echo "--- GL KABLA: $G0"
IDS=$(for t in $TODO; do printf "'%s'," "${t%%:*}"; done); IDS=${IDS%,}
N=$(q "update purchases set payment_status='PAID', amount_paid=total_amount,
         purchase_notes = trim(both ' |' from coalesce(purchase_notes,'')||' | $NOTE'), updated_by='hatua-74', updated_at=now()
       where uid in ($IDS) and payment_status='UNPAID' and amount_paid=0 and not is_deleted returning 1" | grep -cx 1)
[ "$N" = "$(echo $TODO | wc -w)" ] || die "update iligusa $N badala ya $(echo $TODO | wc -w)"
echo "purchases $N: SAWA (PAID)"
G1=$(gl); echo "--- GL BAADA: $G1"
[ "$G1" = "$G0" ] || die "GL imebadilika ($G0 -> $G1)"
echo "---74_MWISHO---"
