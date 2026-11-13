#!/usr/bin/env bash
# HATUA 85 (mmiliki 10/11 el/eo; 13/11 hk/hl) - PROD, 2.5.0 (V143) iko prod tangu 13/11: UHAMISHO wa KUPIMA.
# Bidhaa za kupima zilizopo (vipimo vya bandia: "KONYAGI YA KUPIMA" ...) zinaBADILISHWA (si kufutwa/kusajiliwa upya) -
# historia ya mauzo inabaki. Kwa kila moja (ANDIKA):
#   1. mipangilio: chombo + ujazo + wazazi + vipimo {ml, bei} (+ bei ya mzazi mmoja mmoja ya WINE, hiari)
#   2. vipande vya bandia -> 0 (ADJUSTMENT); thamani yake iliyoko GL: Dr 3900 / Cr 1200 (KUPIMA-GL-EG)
#   3. chupa ILIYO WAZI dukani inaanzishwa kwa ml ALIZOHESABU Chief asubuhi hiyo, BILA kupunguza mzazi (ilishatolewa store
#      kwa mkono ilipofunguliwa). 0 = hakuna iliyo wazi: bar inaonyesha "Hakuna chupa wazi" hadi muuzaji afungue (mzazi -1).
#   bash 85-uhamisho-kupima.sh kagua     KUSOMA TU: wazazi (uid + id inayotarajiwa), wagombea wa GILBEYS / CAMINO kwa jina,
#                                        faida kwa chupa kwa kila mzazi na kipimo (ONYO faida <= 10% ya gharama),
#                                        bidhaa za kupima: vipande, GL ya kufuta, hali; bidhaa nyingine zenye 'pima'
#   bash 85-uhamisho-kupima.sh andika    stdin: email, password ya CEO (KUPIMA_SETTINGS), kisha mistari KEY=thamani:
#        KONYAGI= MOONLIGHT= GOLDENKING= GILBEYS= CAMINO= WINE=   ml zilizohesabiwa kwenye chupa/dumu iliyo wazi (0 = hakuna)
#        WINE_MZAZI=GREPA|MALOT                                    dumu iliyo wazi ilitoka kwa mzazi yupi (WINE > 0 tu)
#        GILBEYS_MZAZI= CAMINO_MZAZI=                              herufi 8 za kwanza za uid kutoka KAGUA ('-' = ruka)
#        CAMINO_BEI=                                               bei ya 50ml (Chief; 0 = ruka CAMINO)
#        WINE_GREPA= WINE_MALOT=                                   hiari: bei ya mzazi huyo "70:2000,80:3000" (tupu = msingi)
# Wazazi (eq): UID wazi kwenye ORODHA (+ id ya kuhakiki); GILBEYS/CAMINO (wapya, hk/hl) ni "?jina" -> KAGUA inaorodhesha
# wagombea, ANDIKA inakubali TU uid ambayo Chief ameitaja (herufi 8) na inalingana na mgombea mmoja. Bidhaa isiyo na mzazi,
# au yenye ingizo lisilo sahihi, inaRUKWA; nyingine zinaendelea. Iliyokwisha hamishwa inarukwa (backend inakataa mara ya pili).
# Maandishi yote ni ASCII (em).
set -uo pipefail
MODE="${1:-}"
H="${L85_HOME:-$HOME}"
DIR="${L85_DIR:-$H/lsms-deployment}"; PROJ="${L85_PROJ:-lsms-deployment}"; BASE="${L85_BASE:-http://localhost}"; HOSTH="${L85_HOST:-elikom.co.tz}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---85_IMESHINDWA---"; exit 1; }

# KEY | bidhaa ya kupima (jina kamili) | wazazi | chombo | ml | vipimo "ml:bei,..." (BEI = kutoka CAMINO_BEI)
#   wazazi: "uid:id[:TAG]" kwa koma (id = ya kuhakiki, hk) au "?jina" (regex, bidhaa mpya - uid inathibitishwa na Chief)
#   Mzazi wa KWANZA ndiye wa chupa iliyo wazi, isipokuwa WINE (WINE_MZAZI).
#   KONYAGI 33 KONYAGI 750ML | MOONLIGHT 105 MOON LIGHT | GOLDENKING 64 GOLDEN KING (12/pkg; 58 ni ndogo 24/pkg)
#   WINE 59 GREPA WINE (hl: "GREPA WINE 5LT") + 102 MA-LOT BOX WINE (es) | GILBEYS / CAMINO 750ml: Chief amesajili 13/11 (hl)
LIST="KONYAGI|KONYAGI YA KUPIMA|d0d16e3c-8a94-45ee-82af-2d595f50e339:33|chupa|750|30:1000
MOONLIGHT|Moon Light Kupima|436b7e69-c8c9-41ef-bd8b-4067af203e8c:105|chupa|750|50:2000
GOLDENKING|GOLDEN KING KUPIMA|0ae6e777-24f3-4875-a738-2598d6656211:64|chupa|750|50:3000
GILBEYS|GILBEYS KUPIMA|?gilbey|chupa|750|50:3000
CAMINO|CAMINO KUPIMA|?camino|chupa|750|50:BEI
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
# (B) thamani iliyoko GL = (vipande - vipande vya ADJUSTMENT za mkono baada ya 30/09, ambazo hazikuwahi kuwa na GL) x avg, si chini ya 0
glvalue() { q "select greatest(0, p.current_stock - coalesce((select sum(s.quantity) from store s where s.products_uid = p.uid and s.movement_type = 'ADJUSTMENT'
   and s.quantity > 0 and s.created_at >= '2026-10-01' and not coalesce(s.is_deleted,false) and coalesce(s.reference,'') not like 'UHM-%'), 0))::numeric * p.current_average_cost
   from products p where p.uid = '$1'" | sed 's/^\([0-9]*\.[0-9][0-9]\).*/\1/'; }

# faida kwa chupa (hl): KEY mzazi gharama cml "ml:bei,..." -> mistari; ONYO faida <= 10% ya gharama (au gharama haijulikani)
ONYO=0
faida() { local key=$1 pn=$2 cost=$3 cml=$4 ms=$5 m ml pr
  for m in ${ms//,/ }; do ml=${m%%:*}; pr=${m#*:}
    awk -v k="$key" -v pn="$pn" -v c="$cost" -v cml="$cml" -v ml="$ml" -v pr="$pr" 'BEGIN {
      est = (c ~ /~$/); sub(/~$/, "", c); n = int(cml / ml)
      if (c == "?" || c + 0 <= 0) { printf "%s | %s | gharama HAIJULIKANI | %sml | %s | %d | %s | ? | ? | ONYO: hakuna avg wala bei ya pkg - nunua kwanza\n", k, pn, ml, pr, n, (pr ~ /^[0-9]+$/ ? n * pr : "?"); exit 2 }
      min = 1.1 * c / n; min = int((min + 499) / 500) * 500; if (min * n - c <= 0.1 * c) min += 500
      if (pr !~ /^[0-9]+$/) { printf "%s | %s | %d%s | %sml | BEI=Chief | %d | ? | ? | ? | ONYO: bei haijawekwa - bei ya chini kwa faida > 10%%: %d (kwa 3000: faida %d)\n", k, pn, c, (est ? " (KADIRIO)" : ""), ml, n, min, n * 3000 - c; exit 2 }
      r = n * pr; f = r - c; p = 100 * f / c
      printf "%s | %s | %d%s | %sml | %d | %d | %d | %d | %.0f%% | %s\n", k, pn, c, (est ? " (KADIRIO: avg 0, bei ya pkg / vipande)" : ""), ml, pr, n, r, f, p,
        (f <= 0.1 * c ? "ONYO: faida <= 10% ya gharama - bei ya chini " min : (est ? "ONYO: avg 0 - chupa itakayofunguliwa sasa itapata gharama 0" : "SAWA"))
      exit (f <= 0.1 * c || est) ? 2 : 0 }' || ONYO=$((ONYO+1))
  done; }
# vipimo vya KEY: CAMINO BEI -> CAMINO_BEI; JSON ya vipimo
mlist() { local ms=$2; [ "$1" = CAMINO ] && [[ "${IN[CAMINO_BEI]:-}" =~ ^[1-9][0-9]*$ ]] && ms=${ms//BEI/${IN[CAMINO_BEI]}}; echo "$ms"; }
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
  [ -n "${L85_CAMINO_BEI:-}" ] && IN[CAMINO_BEI]=$L85_CAMINO_BEI
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
  echo "--- 3 BIDHAA ZA KUPIMA: KEY | bidhaa | vipande vya bandia | avg | GL ya kufuta (B) | mauzo yake ya mwisho | hali"
  TOT=0
  while IFS='|' read -r key name sel cname cml ms; do
    k=$(kupima "$name"); [ -n "$k" ] || { echo "$key | $name | BIDHAA HAIPO"; continue; }
    pcs=$(q "select current_stock||' | '||coalesce(current_average_cost,0)::numeric(19,0) from products where uid='$k'")
    gl=$(glvalue "$k"); last=$(q "select coalesce(max(s.sale_date)::date::text,'-') from sales_details d join sales s on s.uid=d.sale_uid where d.product_uid='$k' and not coalesce(s.is_deleted,false)")
    st="bado"
    if v143; then
      [ "$(q "select count(*) from pour_container where product_uid='$k' and reference_number like 'UHM-%'")" != 0 ] && st="IMESHAHAMISHWA"
      [ "$(q "select count(*) from pour_container where product_uid='$k' and status='OPEN' and reference_number not like 'UHM-%'")" != 0 ] && st="$st; KUNA CHOMBO WAZI (uhamisho utakataa)"
      [ -n "$(q "select 1 from pour_product where product_uid='$k' and active")" ] && st="$st; mipangilio IPO"
    fi
    echo "$key | $name | $pcs | ${gl:-0} | $last | $cname ${cml}ml | $st"
    TOT=$(q "select $TOT + ${gl:-0}")
  done <<< "$LIST"
  echo "  jumla ya GL ya kufuta (Dr 3900 / Cr 1200): $TOT"
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
[[ "${IN[CAMINO_BEI]:-}" =~ ^[0-9]+$ ]] || die "CAMINO_BEI si namba ('${IN[CAMINO_BEI]:-}') - HAKUNA kilichoandikwa"
for t in GREPA MALOT; do v=${IN[WINE_$t]:-}; [ -z "$v" ] || [[ "$v" =~ ^(70|80):[1-9][0-9]*(,(70|80):[1-9][0-9]*)?$ ]] || die "WINE_$t '$v' si 'ml:bei,...' (70/80) - HAKUNA kilichoandikwa"; done
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
api() { local m=$1 p=$2 d=$3; HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X "$m" -H 'Content-Type: application/json' -H "Host: $HOSTH" ${TOKEN:+-H "Authorization: Bearer $TOKEN"} --data "$d" "$BASE$p"); }
okb() { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg() { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 300; }
echo "=== 85 ANDIKA $(date '+%F %T')"; T0=$(tb); echo "--- KABLA: 1200 $(dc 1200)   3900 $(dc 3900)   TB $T0"
TOKEN=; api POST /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"; PASS=
TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); [ -n "$TOKEN" ] || die "login HTTP $HC $(msg)"; echo "login SAWA"
DONE=0; SKIP=0
while IFS='|' read -r key name sel cname cml ms; do
  k=$(kupima "$name"); [ -n "$k" ] || { echo "$key: BIDHAA HAIPO - inarukwa"; SKIP=$((SKIP+1)); continue; }
  if [ "$(q "select count(*) from pour_container where product_uid='$k' and reference_number like 'UHM-%'")" != 0 ]; then echo "$key: imeshahamishwa - inarukwa"; continue; fi
  if [ "$key" = CAMINO ] && [ "${IN[CAMINO_BEI]}" = 0 ]; then echo "$key: CAMINO_BEI 0 - inarukwa (bado ni bidhaa ya zamani)"; SKIP=$((SKIP+1)); continue; fi
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
  gl=$(glvalue "$k"); pcs=$(q "select current_stock from products where uid='$k'")
  api POST "/api/v1/kupima/products/$k/migrate" "{\"countedMl\":${IN[$key]},\"writeOffGl\":${gl:-0},\"note\":\"hatua 85\",\"parentProductUid\":\"$pu\"}"
  if okb; then
    echo "$key: SAWA - vipande $pcs -> 0, GL ${gl:-0} (Dr 3900 / Cr 1200), chombo ${IN[$key]}ml$([ "${IN[$key]}" != 0 ] && echo " kutoka $(pname "$pu")") (mzazi hakupunguzwa)"; DONE=$((DONE+1))
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
[ "$(tb)" = "$T0" ] || die "TB imebadilika ($T0 -> $(tb))"
echo "zimehamishwa $DONE, zimerukwa $SKIP"
echo "---85_MWISHO---"
