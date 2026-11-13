#!/usr/bin/env bash
# HATUA 85 (mmiliki 10/11 el/eo; 13/11 hk/hl) - PROD, 2.5.0 (V143) iko prod tangu 13/11: UHAMISHO wa KUPIMA.
# Bidhaa za kupima zilizopo (vipimo vya bandia: "KONYAGI YA KUPIMA" ...) zinaBADILISHWA (si kufutwa/kusajiliwa upya) -
# historia ya mauzo inabaki. Kwa kila moja (ANDIKA):
#   1. mipangilio: chombo + ujazo + wazazi + vipimo {ml, bei} (+ bei ya mzazi mmoja mmoja ya WINE, hiari)
#   2. vipande vya bandia -> 0 (ADJUSTMENT ya migrate, writeOffGl 0 - backend ingeandika 3900); (hm) thamani yake iliyoko GL
#      inaondoka kwa CHANZO chake, journal ya mkono (FINANCE_WRITE) "HATUA85-HM <uid8>": vipande vilivyotoka kwenye manunuzi
#      yaliyoandikwa Cr 1000 (Chief: hayakulipwa) -> Dr 1000 / Cr 1200; vingine (marekebisho/upotevu wenye GL) -> Dr 5100 / Cr 1200.
#      Kiasi = mtiririko wa GL wa bidhaa (manunuzi + marekebisho yenye journal - gharama ya mauzo) = (vipande - vipande visivyo
#      na GL) x avg; visipolingana -> KEY inarukwa (TOFAUTI). Journal ikishindikana baada ya migrate: ANDIKA tena inaiandika tu.
#   3. chupa ILIYO WAZI dukani inaanzishwa kwa ml ALIZOHESABU Chief asubuhi hiyo, BILA kupunguza mzazi (ilishatolewa store
#      kwa mkono ilipofunguliwa). 0 = hakuna iliyo wazi: bar inaonyesha "Hakuna chupa wazi" hadi muuzaji afungue (mzazi -1).
#   bash 85-uhamisho-kupima.sh kagua     KUSOMA TU: wazazi (uid + id inayotarajiwa), wagombea wa GILBEYS / CAMINO kwa jina,
#                                        faida kwa chupa kwa kila mzazi na kipimo (ONYO faida <= 10% ya gharama),
#                                        bidhaa za kupima: vipande, CHANZO (hm) | journal ya awali | akaunti mpya | kiasi;
#                                        ONYO mzazi avg 0 (ANDIKA itakataa ml > 0 kwake, hm 2); bidhaa nyingine zenye 'pima'
#   bash 85-uhamisho-kupima.sh andika    stdin: email, password ya CEO (KUPIMA_SETTINGS), kisha mistari KEY=thamani:
#        KONYAGI= MOONLIGHT= GOLDENKING= GILBEYS= CAMINO= WINE=   ml zilizohesabiwa kwenye chupa/dumu iliyo wazi (0 = hakuna)
#        WINE_MZAZI=GREPA|MALOT                                    dumu iliyo wazi ilitoka kwa mzazi yupi (WINE > 0 tu)
#        GILBEYS_MZAZI= CAMINO_MZAZI=                              herufi 8 za kwanza za uid kutoka KAGUA ('-' = ruka)
#        WINE_GREPA= WINE_MALOT=                                   hiari: bei ya mzazi huyo "70:2000,80:3000" (tupu = msingi)
# Wazazi (eq): UID wazi kwenye ORODHA (+ id ya kuhakiki); GILBEYS/CAMINO (wapya, hk/hl) ni "?jina" -> KAGUA inaorodhesha
# wagombea, ANDIKA inakubali TU uid ambayo Chief ameitaja (herufi 8) na inalingana na mgombea mmoja. Bidhaa isiyo na mzazi,
# au yenye ingizo lisilo sahihi, inaRUKWA; nyingine zinaendelea. (hm 2) ml > 0 kwa mzazi mwenye avg 0 -> ANDIKA inakataa YOTE
# kabla ya kuandika chochote (andika 0 kwa kinywaji hicho, au andika manunuzi yake kwanza). Iliyokwisha hamishwa inarukwa (backend inakataa mara ya pili).
# Maandishi yote ni ASCII (em).
set -uo pipefail
MODE="${1:-}"
H="${L85_HOME:-$HOME}"
DIR="${L85_DIR:-$H/lsms-deployment}"; PROJ="${L85_PROJ:-lsms-deployment}"; BASE="${L85_BASE:-http://localhost}"; HOSTH="${L85_HOST:-elikom.co.tz}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---85_IMESHINDWA---"; exit 1; }

# KEY | bidhaa ya kupima (jina kamili) | wazazi | chombo | ml | vipimo "ml:bei,..." (hn: Camino 50ml = 4,000; MA-LOT = 5L)
#   wazazi: "uid:id[:TAG]" kwa koma (id = ya kuhakiki, hk) au "?jina" (regex, bidhaa mpya - uid inathibitishwa na Chief)
#   Mzazi wa KWANZA ndiye wa chupa iliyo wazi, isipokuwa WINE (WINE_MZAZI).
#   KONYAGI 33 KONYAGI 750ML | MOONLIGHT 105 MOON LIGHT | GOLDENKING 64 GOLDEN KING (12/pkg; 58 ni ndogo 24/pkg)
#   WINE 59 GREPA WINE (hl: "GREPA WINE 5LT") + 102 MA-LOT BOX WINE (es) | GILBEYS / CAMINO 750ml: Chief amesajili 13/11 (hl)
LIST="KONYAGI|KONYAGI YA KUPIMA|d0d16e3c-8a94-45ee-82af-2d595f50e339:33|chupa|750|30:1000
MOONLIGHT|Moon Light Kupima|436b7e69-c8c9-41ef-bd8b-4067af203e8c:105|chupa|750|50:2000
GOLDENKING|GOLDEN KING KUPIMA|0ae6e777-24f3-4875-a738-2598d6656211:64|chupa|750|50:3000
GILBEYS|GILBEYS KUPIMA|?gilbey|chupa|750|50:3000
CAMINO|CAMINO KUPIMA|?camino|chupa|750|50:4000
WINE|WINE ZA KUPIMA|fd9877ee-e6bd-4cfd-bd9d-20ca46a762ed:59:GREPA,a3081011-e370-4687-a7e7-bc5f02063b23:102:MALOT|dumu|5000|70:2000,80:3000"

LIVE="e.status='POSTED' and not coalesce(e.is_deleted,false)"
tb() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where $LIVE"; }
dc() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code='$1' and $LIVE"; }
v143() { [ "$(q "select count(*) from information_schema.tables where table_name = 'pour_product'")" = 1 ]; }
uidok() { [[ "$1" =~ ^[0-9a-fA-F-]{36}$ ]]; }
NOTPOUR="true"; v143 && NOTPOUR="not exists (select 1 from pour_product x where x.product_uid = p.uid and x.active)"
# mzazi halali: yupo, hajafutwa, si bidhaa ya kupima (jina wala pour_product)
okparent() { [ -n "$(q "select 1 from products p where p.uid='$1' and not coalesce(p.is_deleted,false) and p.product_name not ilike '%pima%' and $NOTPOUR")" ]; }
# wagombea wa "?jina": uid | id | jina | vipande/pkg | stock | avg
cands() { q "select p.uid, p.id, p.product_name, coalesce(p.pieces_per_package::text,'-'), p.current_stock, coalesce(p.current_average_cost,0)::numeric(19,0)
   from products p where p.product_name ~* '$1' and p.product_name not ilike '%pima%' and not coalesce(p.is_deleted,false) and $NOTPOUR order by p.id"; }
# gharama ya chupa/dumu moja ya mzazi: avg; avg 0 -> KADIRIO bei ya pkg / vipande (na alama)
pcost() { q "select case when coalesce(current_average_cost,0) > 0 then round(current_average_cost)::text
   when coalesce(whole_sale_price,0) > 0 and coalesce(pieces_per_package,0) > 0 then round(whole_sale_price / pieces_per_package)::text||'~'
   else '?' end from products where uid='$1'"; }
pname() { q "select product_name from products where uid='$1'"; }
kupima() { q "select uid from products where product_name = '$1' and not coalesce(is_deleted,false)"; }
# (hm) CHANZO cha thamani ya bidhaa kwenye 1200: "manunuzi-Cr1000 | manunuzi-mengine | marekebisho-yenye-GL | gharama-ya-mauzo |
#   mtiririko | vipande-visivyo-na-GL | avg | vipande KABLA ya uhamisho (stock + vilivyoondolewa na UHM) | marejeo ya manunuzi"
src() { q "with pj as (select e.uid, e.reference_number r, (select coalesce(sum(l.debit_amount - l.credit_amount),0) from journal_entry_line l where l.journal_entry_uid = e.uid and l.account_code = '1200') a,
          exists (select 1 from journal_entry_line l where l.journal_entry_uid = e.uid and l.account_code = '1000') c1
        from purchases pu join journal_entry e on e.reference_uid = pu.uid where pu.product_uid = '$1' and $LIVE),
   aj as (select coalesce(sum(l.debit_amount - l.credit_amount),0) a from store s join journal_entry e on e.reference_number = s.reference join journal_entry_line l on l.journal_entry_uid = e.uid
        where s.products_uid = '$1' and s.movement_type = 'ADJUSTMENT' and coalesce(s.reference,'') not like 'UHM-%' and not coalesce(s.is_deleted,false) and $LIVE and l.account_code = '1200'),
   cg as (select coalesce(sum(d.total_cost),0) a from sales_details d join sales x on x.uid = d.sale_uid where d.product_uid = '$1' and not coalesce(d.is_deleted,false) and not coalesce(x.is_deleted,false)),
   ng as (select coalesce(sum(s.quantity),0) n from store s where s.products_uid = '$1' and s.movement_type = 'ADJUSTMENT' and s.quantity > 0 and coalesce(s.reference,'') not like 'UHM-%'
        and not coalesce(s.is_deleted,false) and not exists (select 1 from journal_entry e where e.reference_number = s.reference and $LIVE))
 select coalesce((select sum(a) filter (where c1) from pj),0)::numeric(19,2), coalesce((select sum(a) filter (where not c1) from pj),0)::numeric(19,2), (select a from aj)::numeric(19,2), (select a from cg)::numeric(19,2),
   (coalesce((select sum(a) from pj),0) + (select a from aj) - (select a from cg))::numeric(19,2), (select n from ng), coalesce(p.current_average_cost,0)::numeric(19,2),
   p.current_stock - coalesce((select sum(s.quantity) from store s where s.products_uid = p.uid and s.movement_type = 'ADJUSTMENT' and s.reference like 'UHM-%' and not coalesce(s.is_deleted,false)),0),
   coalesce((select string_agg(left(r,40)||' ['||case when c1 then 'Cr 1000' else 'si 1000' end||' '||a::numeric(19,0)||']', ' ; ') from pj),'-')
 from products p where p.uid = '$1'"; }
# kiasi cha kuondoa = thamani ya vipande vya bandia vilivyo na GL = (vipande kabla ya uhamisho - visivyo na GL) x avg; lazima
#   kilingane na mtiririko wa GL wa bidhaa (+-1), vinginevyo TOFAUTI. Vipande 0 -> 0 (mtiririko wa zamani hauguswi).
#   Dr 1000 = min(kiasi, manunuzi-Cr1000) (Chief hm: hayakulipwa); Dr 5100 = kilichobaki. -> "to1000 to5100 hali"
alloc() { awk -F' [|] ' '{ p1=$1+0; flow=$5+0; ng=$6+0; avg=$7+0; st=$8+0; chk=(st-ng)*avg
    if (st - ng <= 0) { print "0.00 0.00 SAWA"; exit }
    if (chk - flow > 1 || flow - chk > 1) { printf "0.00 0.00 TOFAUTI:mtiririko-%.2f-vipande-%.2f\n", flow, chk; exit }
    t1 = (chk < p1 ? chk : p1); if (t1 < 0) t1 = 0; t5 = chk - t1; if (t5 < 0.005) t5 = 0
    printf "%.2f %.2f SAWA\n", t1, t5 }' <<< "$1"; }
hmdone() { [ -n "$(q "select 1 from journal_entry e where e.reference_number like 'HATUA85-HM ${1:0:8}%' and $LIVE limit 1")" ]; }

# faida kwa chupa (hl): KEY mzazi gharama cml "ml:bei,..." -> mistari; ONYO faida <= 10% ya gharama (au gharama haijulikani)
ONYO=0
faida() { local key=$1 pn=$2 cost=$3 cml=$4 ms=$5 m ml pr
  for m in ${ms//,/ }; do ml=${m%%:*}; pr=${m#*:}
    awk -v k="$key" -v pn="$pn" -v c="$cost" -v cml="$cml" -v ml="$ml" -v pr="$pr" 'BEGIN {
      est = (c ~ /~$/); sub(/~$/, "", c); n = int(cml / ml)
      if (c == "?" || c + 0 <= 0) { printf "%s | %s | gharama HAIJULIKANI | %sml | %s | %d | %s | ? | ? | ONYO: hakuna avg wala bei ya pkg - ANDIKA inakataa ml > 0 hadi manunuzi yaandikwe\n", k, pn, ml, pr, n, (pr ~ /^[0-9]+$/ ? n * pr : "?"); exit 2 }
      min = 1.1 * c / n; min = int((min + 499) / 500) * 500; if (min * n - c <= 0.1 * c) min += 500
      if (pr !~ /^[0-9]+$/) { printf "%s | %s | %d%s | %sml | BEI=Chief | %d | ? | ? | ? | ONYO: bei haijawekwa - bei ya chini kwa faida > 10%%: %d (kwa 3000: faida %d)\n", k, pn, c, (est ? " (KADIRIO)" : ""), ml, n, min, n * 3000 - c; exit 2 }
      r = n * pr; f = r - c; p = 100 * f / c
      printf "%s | %s | %d%s | %sml | %d | %d | %d | %d | %.0f%% | %s\n", k, pn, c, (est ? " (KADIRIO: avg 0, bei ya pkg / vipande)" : ""), ml, pr, n, r, f, p,
        (f <= 0.1 * c ? "ONYO: faida <= 10% ya gharama - bei ya chini " min : (est ? "ONYO: avg 0 (hakuna manunuzi) - ANDIKA INAKATAA ml > 0 kwa mzazi huyu hadi manunuzi yaandikwe (hm)" : "SAWA"))
      exit (f <= 0.1 * c || est) ? 2 : 0 }' || ONYO=$((ONYO+1))
  done; }
# vipimo vya KEY; JSON ya vipimo
mlist() { echo "$2"; }
mjson() { local m o=""; for m in ${1//,/ }; do o="$o{\"ml\":${m%%:*},\"price\":${m#*:}},"; done; echo "[${o%,}]"; }
declare -A IN

# ORODHA ya wazazi wa KEY -> mistari "uid|TAG" (ANDIKA: "?jina" inahitaji KEY_MZAZI; KAGUA: wagombea wote)
parents() { local key=$1 sel=$2 x u id tag c pre
  for x in ${sel//,/ }; do
    if [ "${x:0:1}" = "?" ]; then
      pre=${IN[${key}_MZAZI]:-}
      [[ "$pre" =~ ^[0-9a-fA-F]{8}$ ]] || return 1
      c=$(cands "${x:1}" | awk -F' [|] ' -v p="$pre" 'tolower(substr($1,1,8)) == tolower(p) { print $1 }')
      [ "$(printf '%s\n' "$c" | grep -c .)" = 1 ] || return 1
      okparent "$c" || return 1; echo "$c|"
    else
      u=${x%%:*}; id=$(echo "$x" | cut -d: -f2); tag=$(echo "$x" | cut -d: -f3)
      uidok "$u" && okparent "$u" || return 1
      [ "$(q "select id from products where uid='$u'")" = "$id" ] || return 1
      echo "$u|$tag"
    fi
  done; }

if [ "$MODE" = kagua ]; then
  echo "=== 85 KAGUA $(date '+%F %T') - KUSOMA TU"
  v143 && echo "V143 (KUPIMA): IPO" || echo "V143 (KUPIMA): HAIPO - toleo 2 bado halijafika prod; hatua hii ni BAADA yake"
  echo "--- 1 ORODHA YA WAZAZI (eq, hk) - THIBITISHA: KEY | uid | id (lazima) | jina | aina | vipande/pkg | stock | avg | hali"
  while IFS='|' read -r key name sel cname cml ms; do
    for x in ${sel//,/ }; do
      if [ "${x:0:1}" = "?" ]; then
        c=$(cands "${x:1}"); n=$(printf '%s\n' "$c" | grep -c . || true)
        echo "$key | MGOMBEA kwa jina '${x:1}': $n$([ "$n" = 0 ] && echo ' - HAJASAJILIWA (Chief asajili; KEY itarukwa)')"
        printf '%s\n' "$c" | grep . | sed "s/^/$key |   uid8 \[/; s/^\($key |   uid8 \[\)\(........\)/\1\2] /"
      else
        u=${x%%:*}; id=$(echo "$x" | cut -d: -f2)
        r=$(q "select p.id||' | '||p.product_name||' | '||coalesce(c.category_name,'-')||' | '||coalesce(p.pieces_per_package::text,'-')||' | '||p.current_stock||' | '||coalesce(p.current_average_cost,0)::numeric(19,0)
           ||' | '||case when p.is_deleted then 'IMEFUTWA' when p.product_name ilike '%pima%' then 'NI BIDHAA YA KUPIMA - SI SAHIHI' when p.id <> $id then 'ID SI $id - SI SAHIHI' else 'SAWA' end
           from products p left join categories c on c.uid=p.category_uid where p.uid='$u'")
        echo "$key | $u | ${id} | ${r:-UID HAIPO KWENYE DB}"
      fi
    done
  done <<< "$LIST"
  echo "--- 2 FAIDA KWA CHUPA (hl): KEY | mzazi | gharama/chupa | kipimo | bei | vipimo/chupa | mapato/chupa | faida/chupa | % | hali"
  while IFS='|' read -r key name sel cname cml ms; do
    ms=$(mlist "$key" "$ms")
    for x in ${sel//,/ }; do
      if [ "${x:0:1}" = "?" ]; then
        c=$(cands "${x:1}" | cut -d'|' -f1 | tr -d ' ')
        [ -n "$c" ] || { echo "$key | (hajasajiliwa) | - | - | - | - | - | - | - | inarukwa"; continue; }
        for u in $c; do faida "$key" "$(pname "$u")" "$(pcost "$u")" "$cml" "$ms"; done
      else u=${x%%:*}; faida "$key" "$(pname "$u")" "$(pcost "$u")" "$cml" "$ms"; fi
    done
  done <<< "$LIST"
  echo "  ONYO za faida: $ONYO   (vipimo/chupa = ml ya chombo / ml ya kipimo, chini; gharama = avg ya mzazi = gharama ya chupa itakayofunguliwa)"
  echo "--- 3 BIDHAA ZA KUPIMA: KEY | bidhaa | vipande vya bandia | avg | mauzo yake ya mwisho | chombo | hali"
  T1=0; T5=0; S3=""
  while IFS='|' read -r key name sel cname cml ms; do
    k=$(kupima "$name"); [ -n "$k" ] || { echo "$key | $name | BIDHAA HAIPO"; continue; }
    pcs=$(q "select current_stock||' | '||coalesce(current_average_cost,0)::numeric(19,0) from products where uid='$k'")
    last=$(q "select coalesce(max(s.sale_date)::date::text,'-') from sales_details d join sales s on s.uid=d.sale_uid where d.product_uid='$k' and not coalesce(s.is_deleted,false)")
    st="bado"; mig=0
    if v143; then
      [ "$(q "select count(*) from pour_container where product_uid='$k' and reference_number like 'UHM-%'")" != 0 ] && { st="IMESHAHAMISHWA"; mig=1; }
      [ "$(q "select count(*) from pour_container where product_uid='$k' and status='OPEN' and reference_number not like 'UHM-%'")" != 0 ] && st="$st; KUNA CHOMBO WAZI (uhamisho utakataa)"
      [ -n "$(q "select 1 from pour_product where product_uid='$k' and active")" ] && st="$st; mipangilio IPO"
    fi
    hmdone "$k" && st="$st; journal HATUA85-HM IPO"
    echo "$key | $name | $pcs | $last | $cname ${cml}ml | $st"
    r=$(src "$k"); read -r t1 t5 h <<< "$(alloc "$r" "$mig")"
    IFS='|' read -r p1 po aj cg fl ng av stk refs <<< "${r// | /|}"
    acct=""; [ "$t1" != 0.00 ] && acct="Dr 1000 $t1"; [ "$t5" != 0.00 ] && acct="${acct:+$acct + }Dr 5100 $t5"
    S3="$S3$key | $p1 | $po | $aj | $cg (mtiririko $fl; vipande visivyo na GL $ng) | $refs | ${acct:-hakuna (0)}${acct:+ / Cr 1200} | $(awk -v a="$t1" -v b="$t5" 'BEGIN{printf "%.2f", a+b}') | $h"$'\n'
    T1=$(awk -v a="$T1" -v b="$t1" 'BEGIN{printf "%.2f", a+b}'); T5=$(awk -v a="$T5" -v b="$t5" 'BEGIN{printf "%.2f", a+b}')
  done <<< "$LIST"
  echo "--- 3b CHANZO (hm): KEY | manunuzi Cr 1000 | manunuzi mengine | marekebisho yenye GL | gharama ya mauzo | journal ya awali | akaunti mpya | kiasi | hali"
  printf '%s' "$S3"
  echo "  jumla: Dr 1000 $T1 + Dr 5100 $T5 / Cr 1200 $(awk -v a="$T1" -v b="$T5" 'BEGIN{printf "%.2f", a+b}')   (hm: SI 3900; journal ya mkono 'HATUA85-HM <uid8>' tarehe ya ANDIKA)"
  echo "--- 4 bidhaa NYINGINE zenye 'pima' kwenye jina (85 haizigusi): id | jina | stock"
  q "select p.id, p.product_name, p.current_stock from products p where p.product_name ilike '%pima%' and not coalesce(p.is_deleted,false)
     and p.product_name not in ($(cut -d'|' -f2 <<< "$LIST" | sed "s/.*/'&'/" | paste -sd, -)) order by 1" | sed 's/^/  /'
  echo "--- salio: 1200 $(dc 1200)   3900 $(dc 3900)   TB $(tb)"
  echo "---85_KAGUA_MWISHO---"; exit 0
fi

[ "$MODE" = andika ] || { echo "MATUMIZI: $0 kagua | andika"; exit 2; }
v143 || die "V143 haipo - toleo 2 bado halijafika prod"
IFS= read -r EMAIL || true; IFS= read -r PASS || true; EMAIL=${EMAIL%$'\r'}; PASS=${PASS%$'\r'}
[ -n "$EMAIL" ] && [ -n "$PASS" ] || die "email/password tupu"
while IFS= read -r l; do l=${l%$'\r'}; [ -z "$l" ] && continue; IN[${l%%=*}]=${l#*=}; done
# ingizo lote linakaguliwa KABLA ya kuandika chochote
for key in KONYAGI MOONLIGHT GOLDENKING GILBEYS CAMINO WINE; do
  [[ "${IN[$key]:-}" =~ ^[0-9]+$ ]] || die "ml za $key hazijatolewa au si namba ('${IN[$key]:-}') - HAKUNA kilichoandikwa"
done
[ "${IN[WINE]}" = 0 ] || [[ "${IN[WINE_MZAZI]:-}" =~ ^(GREPA|MALOT)$ ]] || die "WINE_MZAZI lazima GREPA au MALOT (dumu iliyo wazi) - HAKUNA kilichoandikwa"
# (hm 2) ml > 0 kwa mzazi mwenye avg 0 -> KATAA YOTE kabla ya kuandika (chombo kingepata gharama 0)
while IFS='|' read -r key name sel cname cml ms; do
  [ "${IN[$key]}" = 0 ] && continue
  pr=$(parents "$key" "$sel") || continue
  pu=$(head -n1 <<< "$pr" | cut -d'|' -f1); [ "$key" = WINE ] && pu=$(awk -F'|' -v t="${IN[WINE_MZAZI]}" '$2 == t { print $1 }' <<< "$pr")
  [ "$(q "select (coalesce(current_average_cost,0) > 0)::text from products where uid='$pu'")" = true ] \
    || die "$key: mzazi $(pname "$pu") ana avg 0 (hakuna manunuzi) - chombo cha ${IN[$key]}ml kingepata gharama 0. Andika manunuzi yake kwanza, au weka $key=0. HAKUNA kilichoandikwa"
done <<< "$LIST"
for t in GREPA MALOT; do v=${IN[WINE_$t]:-}; [ -z "$v" ] || [[ "$v" =~ ^(70|80):[1-9][0-9]*(,(70|80):[1-9][0-9]*)?$ ]] || die "WINE_$t '$v' si 'ml:bei,...' (70/80) - HAKUNA kilichoandikwa"; done
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
api() { local m=$1 p=$2 d=$3; HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X "$m" -H 'Content-Type: application/json' -H "Host: $HOSTH" ${TOKEN:+-H "Authorization: Bearer $TOKEN"} --data "$d" "$BASE$p"); }
okb() { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg() { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 300; }
# (hm) journal ya chanzo: KEY uid baada-ya-migrate(0/1) jina. Thamani 0 -> hakuna journal (hmdone inakubali: hakuna cha kuandika)
hm() { local key=$1 k=$2 r t1 t5 h lines=""
  r=$(src "$k"); read -r t1 t5 h <<< "$(alloc "$r" "$3")"
  [ "$h" = SAWA ] || { echo "$key: journal ya chanzo HAIJAANDIKWA - $h ($r)"; return 1; }
  [ "$t1" = 0.00 ] && [ "$t5" = 0.00 ] && { echo "$key: thamani kwenye 1200 = 0 - hakuna journal"; return 0; }
  local memo="HATUA85-HM ${k:0:8} $4: stock ya bandia ya KUPIMA kwa chanzo (hm)"
  [ "$t1" != 0.00 ] && lines="$lines{\"accountCode\":\"1000\",\"debit\":$t1,\"credit\":0,\"description\":\"$4: manunuzi ya vipande (Cr 1000, hayakulipwa) yanarudishwa\"},"
  [ "$t5" != 0.00 ] && lines="$lines{\"accountCode\":\"5100\",\"debit\":$t5,\"credit\":0,\"description\":\"$4: vipande vya marekebisho - upotevu\"},"
  lines="$lines{\"accountCode\":\"1200\",\"debit\":0,\"credit\":$(awk -v a="$t1" -v b="$t5" 'BEGIN{printf "%.2f", a+b}'),\"description\":\"$4: stock ya bandia imeondolewa\"}"
  api POST /api/v1/gl/journal-entries/manual "{\"memo\":\"$memo\",\"lines\":[$lines]}"
  if okb && hmdone "$k"; then echo "$key: journal SAWA - Dr 1000 $t1 + Dr 5100 $t5 / Cr 1200"; return 0; fi
  echo "$key: journal ya chanzo IMESHINDWA HTTP $HC $(msg) - endesha ANDIKA tena (itaandika journal tu)"; return 1; }
echo "=== 85 ANDIKA $(date '+%F %T')"; T0=$(tb); echo "--- KABLA: 1200 $(dc 1200)   3900 $(dc 3900)   TB $T0"
TOKEN=; api POST /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"; PASS=
TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); [ -n "$TOKEN" ] || die "login HTTP $HC $(msg)"; echo "login SAWA"
DONE=0; SKIP=0
while IFS='|' read -r key name sel cname cml ms; do
  k=$(kupima "$name"); [ -n "$k" ] || { echo "$key: BIDHAA HAIPO - inarukwa"; SKIP=$((SKIP+1)); continue; }
  if [ "$(q "select count(*) from pour_container where product_uid='$k' and reference_number like 'UHM-%'")" != 0 ]; then
    if hmdone "$k"; then echo "$key: imeshahamishwa (journal HATUA85-HM ipo au haihitajiki) - inarukwa"
    else hm "$key" "$k" 1 "$name" || SKIP=$((SKIP+1)); fi
    continue
  fi
  r=$(src "$k"); read -r t1 t5 h <<< "$(alloc "$r" 0)"
  [ "$h" = SAWA ] || { echo "$key: CHANZO $h ($r) - inarukwa, HAKUNA kilichoandikwa kwake"; SKIP=$((SKIP+1)); continue; }
  ms=$(mlist "$key" "$ms")
  pr=$(parents "$key" "$sel") || { echo "$key: MZAZI HAYUPO / HAJATHIBITISHWA (uid8 '${IN[${key}_MZAZI]:-}', au id hailingani) - inarukwa (endesha KAGUA, kisha ANDIKA tena)"; SKIP=$((SKIP+1)); continue; }
  pus=$(cut -d'|' -f1 <<< "$pr" | sed 's/.*/"&"/' | paste -sd, -)
  pu=$(head -n1 <<< "$pr" | cut -d'|' -f1)
  [ "$key" = WINE ] && [ "${IN[WINE]}" != 0 ] && pu=$(awk -F'|' -v t="${IN[WINE_MZAZI]}" '$2 == t { print $1 }' <<< "$pr")
  pp=""; for t in GREPA MALOT; do v=${IN[WINE_$t]:-}; [ "$key" = WINE ] && [ -n "$v" ] || continue
    u=$(awk -F'|' -v t="$t" '$2 == t { print $1 }' <<< "$pr")
    for m in ${v//,/ }; do pp="$pp{\"parentProductUid\":\"$u\",\"ml\":${m%%:*},\"price\":${m#*:}},"; done; done
  echo "$key: faida kwa chupa kwa bei hizi:"
  while IFS='|' read -r u t; do pms=$ms
    [ "$key" = WINE ] && [ -n "${IN[WINE_$t]:-}" ] && pms=$(awk -v b="$ms" -v o="${IN[WINE_$t]}" 'BEGIN { n = split(o, a, ","); for (i = 1; i <= n; i++) { split(a[i], x, ":"); P[x[1]] = x[2] }
        m = split(b, c, ","); s = ""; for (i = 1; i <= m; i++) { split(c[i], y, ":"); s = s (s ? "," : "") y[1] ":" (y[1] in P ? P[y[1]] : y[2]) } print s }')
    faida "$key" "$(pname "$u")" "$(pcost "$u")" "$cml" "$pms" | sed 's/^/  /'
  done <<< "$pr"
  api PUT "/api/v1/kupima/products/$k" "{\"containerName\":\"$cname\",\"containerMl\":$cml,\"parentProductUids\":[$pus],\"measures\":$(mjson "$ms")${pp:+,\"parentPrices\":[${pp%,}]}}"
  okb || { echo "$key: mipangilio IMESHINDWA HTTP $HC $(msg)"; SKIP=$((SKIP+1)); continue; }
  w=$(grep -o '"warnings" *: *\[[^]]*\]' "$T/b" | head -c 400); [ -n "$w" ] && echo "  onyo la backend: $w"
  pcs=$(q "select current_stock from products where uid='$k'")
  api POST "/api/v1/kupima/products/$k/migrate" "{\"countedMl\":${IN[$key]},\"writeOffGl\":0,\"note\":\"hatua 85 (hm: GL kwa chanzo)\",\"parentProductUid\":\"$pu\"}"
  if okb; then
    echo "$key: SAWA - vipande $pcs -> 0 (bila GL ya backend), chombo ${IN[$key]}ml$([ "${IN[$key]}" != 0 ] && echo " kutoka $(pname "$pu")") (mzazi hakupunguzwa)"; DONE=$((DONE+1))
    hm "$key" "$k" 0 "$name" || SKIP=$((SKIP+1))
  else
    echo "$key: uhamisho IMESHINDWA HTTP $HC $(msg) (mipangilio imehifadhiwa; endesha ANDIKA tena)"; SKIP=$((SKIP+1))
  fi
done <<< "$LIST"
echo "--- BAADA: 1200 $(dc 1200)   3900 $(dc 3900)   TB $(tb)"
echo "--- bidhaa | stock | ml zilizobaki | chombo | wazazi | vipimo"
q "select p.product_name, p.current_stock, coalesce(c.ml_left::text,'-'), coalesce(c.reference_number,'-'),
     (select string_agg(pa.product_name, '+' order by pr.id) from pour_parent pr join products pa on pa.uid = pr.parent_product_uid where pr.product_uid = pp.product_uid and pr.active),
     (select string_agg(m.ml||'ml='||m.price::numeric(19,0), ' ' order by m.ml) from pour_measure m where m.product_uid = pp.product_uid and m.active)
   from pour_product pp join products p on p.uid = pp.product_uid
   left join pour_container c on c.product_uid = pp.product_uid and c.status = 'OPEN' where pp.active order by 1"
echo "--- journal za HATUA85-HM: marejeo | akaunti | Dr | Cr"
q "select left(e.reference_number,40), l.account_code, l.debit_amount::numeric(19,2), l.credit_amount::numeric(19,2) from journal_entry e join journal_entry_line l on l.journal_entry_uid = e.uid
   where e.reference_number like 'HATUA85-HM %' and $LIVE order by e.reference_number, l.account_code"
[ "$(tb)" = "$T0" ] || die "TB imebadilika ($T0 -> $(tb))"
echo "zimehamishwa $DONE, zimerukwa $SKIP"
echo "---85_MWISHO---"
