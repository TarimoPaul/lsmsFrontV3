#!/usr/bin/env bash
# Majaribio ya 85 (eq): wazazi kwa orodha ya uid. Local copy ya 29/10, backend f69e42d (V143).
set -u
SP="$(mktemp -d)"; trap 'echo "logs: $SP"' EXIT
STEP="${L85_STEP:-/d/MY PROJECT/DUKA PROJECT/LsmsVersion3/lsmsFrontV3/analysis/steps/85-uhamisho-kupima.sh}"
LOC="/d/MY PROJECT/DUKA PROJECT/Lsms/Lsms-t2-kupima/deploy/local"
export L85_DIR="$LOC" L85_PROJ=lsms-local L85_BASE=http://127.0.0.1:18090
. "$LOC/.siri"
P=0; F=0
ok() { if eval "$2"; then echo "PASS $1"; P=$((P+1)); else echo "FAIL $1"; F=$((F+1)); fi; }
psq() { docker exec lsms-local-postgres-1 psql -U postgres -d Lsms -At -c "$1"; }
UID58=$(psq "select uid from products where id=58"); UID52=$(psq "select uid from products where id=52")
PARENTS="select string_agg(id||':'||current_stock, ',' order by id) from products where id in (33,58,59,64,105)"
SALES="select count(*) from sales_details"
TB="select sum(debit_amount-credit_amount) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)"
P0=$(psq "$PARENTS"); S0=$(psq "$SALES"); TB0=$(psq "$TB")

# T1: faili halisi - hakuna kutafuta kwa jina; KAGUA inaonyesha orodha
ok "T1a LIST haina 'ilike' wala 'product_name ='" "! sed -n '/^LIST=/,/\"$/p' \"$STEP\" | grep -Eq 'ilike|product_name ='"
ok "T1b L85_PARENT override imeondolewa" "! grep -q 'L85_PARENT' \"$STEP\""
bash "$STEP" kagua > "$SP/t85-k1.log" 2>&1
ok "T1c KONYAGI -> 33 KONYAGI 750ML SAWA" "grep -Eq '^KONYAGI \| KONYAGI YA KUPIMA \| d0d16e3c[^|]* \| 33 \| KONYAGI 750ML \|.*\| SAWA$' $SP/t85-k1.log"
ok "T1d WINE -> 59 GREPA WINE SAWA" "grep -Eq '^WINE \| WINE ZA KUPIMA \| fd9877ee[^|]* \| 59 \| GREPA WINE \|.*\| SAWA$' $SP/t85-k1.log"
ok "T1e GILBEYS/CAMINO HAIJAWEKWA" "[ \$(grep -c 'HAIJAWEKWA' $SP/t85-k1.log) = 2 ]"
ok "T1f MOONLIGHT 105, GOLDENKING 64" "grep -q '| 105 | MOON LIGHT |' $SP/t85-k1.log && grep -q '| 64 | GOLDEN KING |' $SP/t85-k1.log"
ok "T1g KAGUA imemalizika" "grep -q -- '---85_KAGUA_MWISHO---' $SP/t85-k1.log"

# nakala ya majaribio: GILBEYS = 58 (kujaribu tu), CAMINO = uid ya bidhaa ya kupima 52 (lazima ikataliwe)
T="$SP/t85-copy.sh"
sed -e "s/^GILBEYS|GILBEYS KUPIMA|-|/GILBEYS|GILBEYS KUPIMA|$UID58|/" -e "s/^CAMINO|CAMINO KUPIMA|-|/CAMINO|CAMINO KUPIMA|$UID52|/" "$STEP" > "$T"
ok "T2a nakala imebadilishwa" "grep -q \"^GILBEYS|GILBEYS KUPIMA|$UID58|\" \"$T\" && grep -q \"^CAMINO|CAMINO KUPIMA|$UID52|\" \"$T\""
bash "$T" kagua > "$SP/t85-k2.log" 2>&1
ok "T2b CAMINO uid ya kupima -> SI SAHIHI" "grep -q '^CAMINO .*NI BIDHAA YA KUPIMA - SI SAHIHI' $SP/t85-k2.log"
sed -e "s/^CAMINO|CAMINO KUPIMA|$UID52|/CAMINO|CAMINO KUPIMA|00000000-0000-0000-0000-000000000000|/" "$T" > "$SP/t85-copy2.sh"
bash "$SP/t85-copy2.sh" kagua > "$SP/t85-k3.log" 2>&1
ok "T2c uid isiyokuwepo -> UID HAIPO" "grep -q '^CAMINO .*UID HAIPO KWENYE DB' $SP/t85-k3.log"

printf 'root@system.com\n%s\nKONYAGI=375\nMOONLIGHT=750\nGOLDENKING=188\nGILBEYS=0\nCAMINO=0\nWINE=2500\n' "$LOCAL_ROOT_PASSWORD" | bash "$T" andika > "$SP/t85-a1.log" 2>&1
ok "T3a ANDIKA imemalizika" "grep -q -- '---85_MWISHO---' $SP/t85-a1.log"
ok "T3b zimehamishwa 5, zimerukwa 1" "grep -q 'zimehamishwa 5, zimerukwa 1' $SP/t85-a1.log"
ok "T3c CAMINO imerukwa kwa sababu ni kupima" "grep -q '^CAMINO: MZAZI HAYUPO (.*SI SAHIHI' $SP/t85-a1.log"
ok "T3d WINE SAWA, chombo 2500" "grep -q '^WINE: SAWA .*chombo 2500ml' $SP/t85-a1.log"
WP=$(psq "select p.product_name from pour_product pp join products k on k.uid=pp.product_uid join products p on p.uid=pp.parent_product_uid where k.id=91")
ok "T3e mzazi wa WINE kwenye DB = GREPA WINE ($WP)" "[ \"$WP\" = 'GREPA WINE' ]"
ok "T3f wazazi hawajaguswa ($P0)" "[ \"\$(psq \"$PARENTS\")\" = \"$P0\" ]"
ok "T3g mistari ya mauzo haijabadilika" "[ \"\$(psq \"$SALES\")\" = \"$S0\" ]"
ok "T3h TB haijabadilika ($TB0)" "[ \"\$(psq \"$TB\")\" = \"$TB0\" ]"

printf 'root@system.com\n%s\nKONYAGI=375\nMOONLIGHT=750\nGOLDENKING=188\nGILBEYS=0\nCAMINO=0\nWINE=2500\n' "$LOCAL_ROOT_PASSWORD" | bash "$T" andika > "$SP/t85-a2.log" 2>&1
ok "T4 mara ya pili: 5 imeshahamishwa, 0 mpya" "[ \$(grep -c 'imeshahamishwa - inarukwa' $SP/t85-a2.log) = 5 ] && grep -q 'zimehamishwa 0, zimerukwa 1' $SP/t85-a2.log"
echo "MATOKEO $P/$F"
