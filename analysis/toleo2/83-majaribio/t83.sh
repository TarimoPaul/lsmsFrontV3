#!/usr/bin/env bash
# Majaribio ya hatua 83 kwenye Docker-local (image ya prod 2.4.0, nakala safi ya 29/10, PG15).
S="/d/MY PROJECT/DUKA PROJECT/LsmsVersion3/lsmsFrontV3/analysis/steps/83-vipimo-cash.sh"
export L83_DIR="/d/MY PROJECT/DUKA PROJECT/Lsms/Lsms-t2/deploy/local" L83_PROJ=lsms-local L83_BASE=http://127.0.0.1:18090
CEO=tarimo@gmail.com; PW='T83-Jaribio-Local-2026'
q(){ docker exec -i lsms-local-postgres-1 psql -U postgres -d Lsms -At -F '|' -c "$1"; }
P=0; F=0; ok(){ if eval "$2"; then P=$((P+1)); echo "PASS $1"; else F=$((F+1)); echo "FAIL $1"; fi; }
dc(){ q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code='$1' and e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
tb(){ q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
HASH=$(python -c "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())" "$PW")
q "update users set password='$HASH', status='ACTIVE', is_locked=false where email='$CEO'" >/dev/null
q "update gl_config set bank_cutover_date=null" >/dev/null
nj(){ q "select count(*) from journal_entry"; }

o=$(bash "$S" kagua 2>&1); ok "K1 kagua: manunuzi 9, Cr 1000 = 159000, cutover HAIJAWEKWA" '[[ "$o" == *"9 | 159000"* && "$o" == *HAIJAWEKWA* && "$o" == *"---83_KAGUA_MWISHO---"* ]] && [ "$(echo "$o" | grep -c "1000:-")" = 9 ]'
n0=$(nj); o=$(printf '%s\n' "$CEO" "nenosiri-baya" | bash "$S" andika 2>&1); ok "A1 password mbaya -> SIMAMA, hakuna journal" '[[ "$o" == *"login HTTP"* ]] && [ "$(nj)" = "$n0" ]'
q "update gl_config set bank_cutover_date = current_date - 1" >/dev/null
o=$(printf '%s\n' "$CEO" "$PW" | bash "$S" andika 2>&1); ok "A2 cutover D imefika -> SIMAMA" '[[ "$o" == *"cutover D"* && "$o" == *IMESHINDWA* ]] && [ "$(nj)" = "$n0" ]'
q "update gl_config set bank_cutover_date = current_date + 5" >/dev/null
q "insert into gl_period (uid, period_year, period_month, status) values (gen_random_uuid()::text, extract(year from current_date), extract(month from current_date), 'CLOSED')" >/dev/null
o=$(printf '%s\n' "$CEO" "$PW" | bash "$S" andika 2>&1); ok "A3 kipindi kimefungwa -> SIMAMA" '[[ "$o" == *kimefungwa* ]] && [ "$(nj)" = "$n0" ]'
q "delete from gl_period where period_year=extract(year from current_date) and period_month=extract(month from current_date) and period_name is null and status='CLOSED'" >/dev/null
C0=$(dc 1000); E0=$(dc 3900); T0=$(tb)
o=$(printf '%s\n' "$CEO" "$PW" | bash "$S" andika 2>&1); echo "$o" | tail -6
ok "W1 andika (D bado haijafika): 1000 +159,000, 3900 -159,000, TB haijabadilika" '[[ "$o" == *"---83_MWISHO---"* ]] && [ "$(q "select ($(dc 1000))::numeric - ($C0)::numeric")" = 159000.00 ] && [ "$(q "select ($(dc 3900))::numeric - ($E0)::numeric")" = -159000.00 ] && [ "$(tb)" = "$T0" ]'
ok "W2 journal: tarehe ya leo, maelezo ya (eh)" '[ "$(q "select count(*) from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_number='"'"'MAREKEBISHO-83-VIPIMO'"'"' and e.entry_date=current_date and l.description like '"'"'Marekebisho: manunuzi ya vipimo 20/02%hayakulipwa (Chief 10/11)'"'"'")" = 2 ]'
n1=$(nj); o=$(printf '%s\n' "$CEO" "$PW" | bash "$S" andika 2>&1); ok "W3 mara ya pili -> inakataa (IPO TAYARI), hakuna journal mpya" '[[ "$o" == *"IPO TAYARI"* && "$o" == *IMESHINDWA* ]] && [ "$(nj)" = "$n1" ]'
o=$(bash "$S" kagua 2>&1); ok "K2 kagua baada: journal ya 83 = 1" '[[ "$o" == *"journal ya 83 tayari: 1"* ]]'
q "update gl_config set bank_cutover_date=null" >/dev/null
echo "MWISHO PASS $P FAIL $F"
