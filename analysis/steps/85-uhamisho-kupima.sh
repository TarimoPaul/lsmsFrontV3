#!/usr/bin/env bash
# HATUA 85 (mmiliki 10/11 el/eo) - PROD, BAADA ya toleo 2 (V143) kufika prod: UHAMISHO wa KUPIMA.
# Bidhaa za kupima zilizopo zinaBADILISHWA (si kufutwa/kusajiliwa upya) - historia ya mauzo inabaki. Kwa kila moja:
#   1. mipangilio (eo): chombo + ujazo + mzazi + vipimo
#   2. (B) vipande vya bandia -> 0; thamani yake iliyoko GL: Dr 3900 / Cr 1200 (KUPIMA-GL-EG)
#   3. chombo kilicho wazi kinafunguliwa kwa ml ALIZOHESABU Chief siku hiyo, BILA kupunguza mzazi
#   bash 85-uhamisho-kupima.sh kagua     KUSOMA TU: kila bidhaa, mzazi (yupi hayupo), vipande, kiasi cha GL, hali ya V143
#   bash 85-uhamisho-kupima.sh andika    stdin = email, password ya CEO (KUPIMA_SETTINGS), kisha mistari 6 KEY=ml
#                                        (KONYAGI= MOONLIGHT= GOLDENKING= GILBEYS= CAMINO= WINE=; 0 = hakuna chombo wazi)
# (eq) Wazazi ni ORODHA YA UID wazi hapa chini (si kutafuta kwa jina). KAGUA inaonyesha orodha hiyo (uid, id, jina, stock, avg)
# ili Chief aithibitishe kabla ya ANDIKA. Uid "-" = mzazi bado hajasajiliwa -> bidhaa inaRUKWA; uid isiyopatikana/iliyofutwa,
# au ambayo ni bidhaa ya kupima yenyewe -> inaRUKWA. Nyingine zinaendelea.
# Iliyokwisha hamishwa inarukwa (backend inakataa mara ya pili). Maandishi yote ni ASCII (em).
set -uo pipefail
MODE="${1:-}"
H="${L85_HOME:-$HOME}"
DIR="${L85_DIR:-$H/lsms-deployment}"; PROJ="${L85_PROJ:-lsms-deployment}"; BASE="${L85_BASE:-http://localhost}"
cd "$DIR" || { echo "SIYO: $DIR haipo"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
q() { docker compose -p "$PROJ" exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -At -F " | " -c "$SQL"' < /dev/null; }
die() { echo "SIYO: $*"; echo "---85_IMESHINDWA---"; exit 1; }

# KEY | bidhaa ya kupima (jina kamili) | UID YA MZAZI ("-" = bado) | chombo | ml | vipimo (JSON)
#   KONYAGI    -> 33  KONYAGI 750ML
#   MOONLIGHT  -> 105 MOON LIGHT
#   GOLDENKING -> 64  GOLDEN KING (12/katoni) - Chief athibitishe (ep)
#   GILBEYS / CAMINO -> Chief atasajili (ep); uid itawekwa hapa baada ya kusajili
#   WINE       -> 59  GREPA WINE = dumu 5L (eq; jina litakuwa "GREPA WINE 5L")
LIST="KONYAGI|KONYAGI YA KUPIMA|d0d16e3c-8a94-45ee-82af-2d595f50e339|chupa|750|[{\"ml\":30,\"price\":1000}]
MOONLIGHT|Moon Light Kupima|436b7e69-c8c9-41ef-bd8b-4067af203e8c|chupa|750|[{\"ml\":50,\"price\":2000}]
GOLDENKING|GOLDEN KING KUPIMA|0ae6e777-24f3-4875-a738-2598d6656211|chupa|750|[{\"ml\":50,\"price\":3000}]
GILBEYS|GILBEYS KUPIMA|-|chupa|750|[{\"ml\":50,\"price\":3000}]
CAMINO|CAMINO KUPIMA|-|chupa|750|[{\"ml\":50,\"price\":3000}]
WINE|WINE ZA KUPIMA|fd9877ee-e6bd-4cfd-bd9d-20ca46a762ed|dumu|5000|[{\"ml\":70,\"price\":2000},{\"ml\":80,\"price\":3000}]"

tb() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
dc() { q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code='$1' and e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
# mzazi (eq): uid kutoka ORODHA tu. Inarudisha "uid | jina" au tupu (haijawekwa / haipo / imefutwa / ni bidhaa ya kupima).
uidok() { [[ "$1" =~ ^[0-9a-fA-F-]{36}$ ]]; }
parent() { local pu=$2 pp=""; uidok "$pu" || return 0
  v143 && pp="and not exists (select 1 from pour_product x where x.product_uid = p.uid)"
  q "select uid||' | '||product_name from products p where uid='$pu' and not coalesce(is_deleted,false)
     and p.product_name not ilike '%pima%' $pp"; }
# hali ya mzazi kwa KAGUA: maelezo kamili ya kuthibitisha
pinfo() { local pu=$1; if [ "$pu" = - ]; then echo "- | HAIJAWEKWA (Chief asajili mzazi, uid iwekwe kwenye 85)"; return; fi
  uidok "$pu" || { echo "$pu | UID SI HALALI"; return; }
  local r; r=$(q "select p.id||' | '||p.product_name||' | '||coalesce(c.category_name,'-')||' | stock '||p.current_stock||' | avg '||coalesce(p.current_average_cost,0)::numeric(19,0)
     ||' | '||case when p.is_deleted then 'IMEFUTWA' when p.product_name ilike '%pima%' then 'NI BIDHAA YA KUPIMA - SI SAHIHI' else 'SAWA' end
     from products p left join categories c on c.uid=p.category_uid where p.uid='$pu'")
  [ -n "$r" ] && echo "$pu | $r" || echo "$pu | UID HAIPO KWENYE DB"; }
kupima() { q "select uid from products where product_name = '$1' and not coalesce(is_deleted,false)"; }
# (B) thamani iliyoko GL = (vipande - vipande vya ADJUSTMENT za mkono baada ya 30/09, ambazo hazikuwahi kuwa na GL) x avg, si chini ya 0
glvalue() { q "select greatest(0, p.current_stock - coalesce((select sum(s.quantity) from store s where s.products_uid = p.uid and s.movement_type = 'ADJUSTMENT'
   and s.quantity > 0 and s.created_at >= '2026-10-01' and not coalesce(s.is_deleted,false) and coalesce(s.reference,'') not like 'UHM-%'), 0))::numeric * p.current_average_cost
   from products p where p.uid = '$1'" | sed 's/^\([0-9]*\.[0-9][0-9]\).*/\1/'; }
v143() { [ "$(q "select count(*) from information_schema.tables where table_name = 'pour_product'")" = 1 ]; }

if [ "$MODE" = kagua ]; then
  echo "=== 85 KAGUA $(date '+%F %T') - KUSOMA TU"
  v143 && echo "V143 (KUPIMA): IPO" || echo "V143 (KUPIMA): HAIPO - toleo 2 bado halijafika prod; hatua hii ni BAADA yake"
  echo "--- ORODHA YA WAZAZI (eq) - THIBITISHA kabla ya ANDIKA: KEY | bidhaa ya kupima | uid ya mzazi | id | jina | aina | stock | avg | hali"
  while IFS='|' read -r key name sel cname cml ms; do echo "$key | $name | $(pinfo "$sel")"; done <<< "$LIST"
  echo "--- KEY | bidhaa ya kupima | vipande vya bandia | avg | GL ya kufuta (B) | mzazi | chombo | vipimo | hali"
  TOT=0
  while IFS='|' read -r key name sel cname cml ms; do
    k=$(kupima "$name"); [ -n "$k" ] || { echo "$key | $name | BIDHAA HAIPO"; continue; }
    pr=$(parent "$key" "$sel"); n=$(printf '%s\n' "$pr" | grep -c . || true)
    if [ "$n" = 1 ]; then pn=$(printf '%s' "$pr" | cut -d'|' -f2- | sed 's/^ *//'); else pn="MZAZI HAYUPO - itarukwa"; fi
    pcs=$(q "select current_stock||' | '||current_average_cost::numeric(19,0) from products where uid='$k'")
    gl=$(glvalue "$k")
    st="bado"
    if v143; then
      [ "$(q "select count(*) from pour_container where product_uid='$k' and reference_number like 'UHM-%'")" != 0 ] && st="IMESHAHAMISHWA"
      [ "$(q "select count(*) from pour_container where product_uid='$k' and status='OPEN' and reference_number not like 'UHM-%'")" != 0 ] && st="$st; KUNA CHOMBO WAZI (uhamisho utakataa)"
    fi
    echo "$key | $name | $pcs | $gl | $pn | $cname ${cml}ml | $ms | $st"
    TOT=$(q "select $TOT + $gl")
  done <<< "$LIST"
  echo "--- jumla ya GL ya kufuta (Dr 3900 / Cr 1200): $TOT   (KUPIMA-GL-EG: 36,000 tarehe 29/10; mauzo ya vipande tangu hapo yanapunguza)"
  echo "--- salio: 1200 $(dc 1200)   3900 $(dc 3900)   TB $(tb)"
  echo "---85_KAGUA_MWISHO---"; exit 0
fi

[ "$MODE" = andika ] || { echo "MATUMIZI: $0 kagua | andika"; exit 2; }
v143 || die "V143 haipo - toleo 2 bado halijafika prod"
IFS= read -r EMAIL || true; IFS= read -r PASS || true; EMAIL=${EMAIL%$'\r'}; PASS=${PASS%$'\r'}
[ -n "$EMAIL" ] && [ -n "$PASS" ] || die "email/password tupu"
declare -A ML
while IFS= read -r l; do l=${l%$'\r'}; [ -z "$l" ] && continue; ML[${l%%=*}]=${l#*=}; done
for key in KONYAGI MOONLIGHT GOLDENKING GILBEYS CAMINO WINE; do
  [[ "${ML[$key]:-}" =~ ^[0-9]+$ ]] || die "ml za $key hazijatolewa au si namba ('${ML[$key]:-}') - HAKUNA kilichoandikwa"
done
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
api() { local m=$1 p=$2 d=$3; HC=$(curl -s -o "$T/b" -w '%{http_code}' --max-time 60 -X "$m" -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' ${TOKEN:+-H "Authorization: Bearer $TOKEN"} --data "$d" "$BASE$p"); }
okb() { [ "$HC" = 200 ] && grep -Eq '"status" *: *"Success"' "$T/b"; }
msg() { sed -n 's/.*"message" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -c 300; }
echo "=== 85 ANDIKA $(date '+%F %T')"; T0=$(tb); echo "--- KABLA: 1200 $(dc 1200)   3900 $(dc 3900)   TB $T0"
TOKEN=; api POST /api/auth/login "{\"email\":\"$(jesc "$EMAIL")\",\"password\":\"$(jesc "$PASS")\"}"; PASS=
TOKEN=$(sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' "$T/b" | head -n1); [ -n "$TOKEN" ] || die "login HTTP $HC $(msg)"; echo "login SAWA"
DONE=0; SKIP=0
while IFS='|' read -r key name sel cname cml ms; do
  k=$(kupima "$name"); [ -n "$k" ] || { echo "$key: BIDHAA HAIPO - inarukwa"; SKIP=$((SKIP+1)); continue; }
  if [ "$(q "select count(*) from pour_container where product_uid='$k' and reference_number like 'UHM-%'")" != 0 ]; then echo "$key: imeshahamishwa - inarukwa"; continue; fi
  pr=$(parent "$key" "$sel"); n=$(printf '%s\n' "$pr" | grep -c . || true)
  [ "$n" = 1 ] || { echo "$key: MZAZI HAYUPO ($(pinfo "$sel" | cut -d'|' -f2- | sed 's/^ *//')) - inarukwa (weka uid kwenye 85, kisha endesha tena)"; SKIP=$((SKIP+1)); continue; }
  pu=$(printf '%s' "$pr" | cut -d'|' -f1 | tr -d ' ')
  api PUT "/api/v1/kupima/products/$k" "{\"containerName\":\"$cname\",\"containerMl\":$cml,\"parentProductUid\":\"$pu\",\"measures\":$ms}"
  okb || { echo "$key: mipangilio IMESHINDWA HTTP $HC $(msg)"; SKIP=$((SKIP+1)); continue; }
  gl=$(glvalue "$k"); pcs=$(q "select current_stock from products where uid='$k'")
  api POST "/api/v1/kupima/products/$k/migrate" "{\"countedMl\":${ML[$key]},\"writeOffGl\":$gl,\"note\":\"hatua 85\"}"
  if okb; then
    echo "$key: SAWA - vipande $pcs -> 0, GL $gl (Dr 3900 / Cr 1200), chombo ${ML[$key]}ml (mzazi hakupunguzwa)"; DONE=$((DONE+1))
  else
    echo "$key: uhamisho IMESHINDWA HTTP $HC $(msg)"; SKIP=$((SKIP+1))
  fi
done <<< "$LIST"
echo "--- BAADA: 1200 $(dc 1200)   3900 $(dc 3900)   TB $(tb)"
q "select p.product_name, p.current_stock, coalesce(c.ml_left::text,'-'), coalesce(c.reference_number,'-') from pour_product pp join products p on p.uid = pp.product_uid
   left join pour_container c on c.product_uid = pp.product_uid and c.status = 'OPEN' order by 1"
[ "$(tb)" = "$T0" ] || die "TB imebadilika ($T0 -> $(tb))"
echo "zimehamishwa $DONE, zimerukwa $SKIP"
echo "---85_MWISHO---"
