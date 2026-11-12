#!/usr/bin/env bash
# Majaribio ya hatua 74b (gb) kwenye Docker-local: nakala safi ya dump 29/10. Nakala ya kutupa tu.
#   K1 kagua: idadi/jumla/tarehe; YA_KUANDIKA + TOFAUTI = yote; hakuna kilichobadilika
#   A1 andika na idadi isiyo sahihi -> imekataliwa, hakuna kilichobadilika
#   A2 andika na idadi ya kagua -> PAID wote wa GL-SAWA/BILA-GL; GL (TB, 1000, 1200, 2000, journal) haibadiliki; TOFAUTI zinabaki
#   A3 andika tena -> YA_KUANDIKA 0, hakuna cha kuandika
S="/d/MY PROJECT/DUKA PROJECT/LsmsVersion3/lsmsFrontV3/analysis/steps/74b-bila-msambazaji.sh"
export L74B_DIR="/d/MY PROJECT/DUKA PROJECT/Lsms/Lsms-t2-hesabu/deploy/local" L74B_PROJ=lsms-local
q(){ docker exec -i lsms-local-postgres-1 psql -U postgres -d Lsms -At -F '|' -c "$1"; }
P=0; F=0; ok(){ if eval "$2"; then P=$((P+1)); echo "PASS $1"; else F=$((F+1)); echo "FAIL $1"; echo "$o" | tail -8; fi; }
BASE="(supplier_uid is null or supplier_uid = '') and payment_status = 'UNPAID' and coalesce(amount_paid,0) = 0 and coalesce(status,'') <> 'CANCELLED' and not coalesce(is_deleted,false)"
paid(){ q "select count(*) from purchases where payment_status='PAID'"; }
ALL=$(q "select count(*) from purchases where $BASE"); PAID0=$(paid)

o=$(bash "$S" kagua 2>&1); echo "$o" > "$TEMP/t74b-kagua.out"
N=$(echo "$o" | sed -n 's/^  YA_KUANDIKA \([0-9]*\)$/\1/p')
TOF=$(echo "$o" | sed -n 's/^  TOFAUTI | \([0-9]*\) | .*/\1/p'); TOF=${TOF:-0}
ok "K1 kagua: yote $ALL = YA_KUANDIKA $N + TOFAUTI $TOF; hakuna kilichobadilika" '[ -n "$N" ] && [ $((N + TOF)) = "$ALL" ] && [ "$(paid)" = "$PAID0" ] && [[ "$o" == *"---74B_KAGUA_MWISHO---"* ]]'
echo "$o" | sed -n '/--- yote/,/--- kwa jina/p'

o=$(L74B_N=$((N + 1)) bash "$S" andika 2>&1)
ok "A1 idadi isiyo sahihi -> imekataliwa, hakuna kilichobadilika" '[[ "$o" == *"---74B_IMESHINDWA---"* ]] && [ "$(paid)" = "$PAID0" ]'

o=$(L74B_N=$N bash "$S" andika 2>&1)
G0=$(echo "$o" | sed -n 's/^--- GL KABLA: //p'); G1=$(echo "$o" | sed -n 's/^--- GL BAADA: //p')
ok "A2 andika: $N -> PAID, GL haibadiliki ($G0), TOFAUTI $TOF zinabaki" '[[ "$o" == *"---74B_MWISHO---"* ]] && [ "$(paid)" = $((PAID0 + N)) ] && [ -n "$G0" ] && [ "$G0" = "$G1" ] && [ "$(q "select count(*) from purchases where $BASE")" = "$TOF" ]'

o=$(bash "$S" kagua 2>&1); N2=$(echo "$o" | sed -n 's/^  YA_KUANDIKA \([0-9]*\)$/\1/p')
o=$(L74B_N=0 bash "$S" andika 2>&1)
ok "A3 mara ya pili: YA_KUANDIKA 0, hakuna cha kuandika" '[ "$N2" = 0 ] && [[ "$o" == *"hakuna cha kuandika"* ]]'
echo "MWISHO PASS $P FAIL $F"
[ $F = 0 ]
