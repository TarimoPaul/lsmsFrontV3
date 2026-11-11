#!/usr/bin/env bash
# Majaribio ya hatua 88 kwenye Docker-local (nakala ya 29/10, PG15).
S="/d/MY PROJECT/DUKA PROJECT/LsmsVersion3/lsmsFrontV3/analysis/steps/88-frame-jan-ya-tatu.sh"
export L88_DIR="/d/MY PROJECT/DUKA PROJECT/Lsms/Lsms-t2-tozo/deploy/local" L88_PROJ=lsms-local L88_BASE=http://127.0.0.1:18090
CEO=tarimo@gmail.com; PW='T88-Jaribio-Local-2026'
q(){ docker exec -i lsms-local-postgres-1 psql -U postgres -d Lsms -At -F '|' -c "$1"; }
P=0; F=0; ok(){ if eval "$2"; then P=$((P+1)); echo "PASS $1"; else F=$((F+1)); echo "FAIL $1"; fi; }
dc(){ q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code='$1' and e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
tb(){ q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
HASH=$(python -c "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())" "$PW")
q "update users set password='$HASH', status='ACTIVE', is_locked=false where email='$CEO'" >/dev/null
q "update gl_config set bank_cutover_date=null, posting_enabled=true" >/dev/null
nj(){ q "select count(*) from journal_entry"; }
o=$(bash "$S" kagua 2>&1); echo "$o" > /tmp/t88-kagua.out
ok "K1 kagua: row 200000|2400000|APPROVED, journal 1|200000|200000, Sep rows 2, MWISHO" '[[ "$o" == *"row: 200000 | 2400000 | APPROVED"* && "$o" == *"journal ya row: 1 | 200000 | 200000"* && "$o" == *06AC14BB* && "$o" == *4B6D0F55* && "$o" == *"---88_KAGUA_MWISHO---"* ]]'
n0=$(nj); o=$(printf '%s\n' "$CEO" "nenosiri-baya" | bash "$S" andika 2>&1); ok "A1 password mbaya -> SIMAMA, hakuna journal" '[[ "$o" == *"login HTTP"* ]] && [ "$(nj)" = "$n0" ]'
q "update gl_config set bank_cutover_date = current_date - 1" >/dev/null
o=$(printf '%s\n' "$CEO" "$PW" | bash "$S" andika 2>&1); ok "A2 cutover D imefika -> SIMAMA" '[[ "$o" == *"cutover D"* && "$o" == *IMESHINDWA* ]] && [ "$(nj)" = "$n0" ]'
q "update gl_config set bank_cutover_date = null" >/dev/null
q "update capital_expenditure set amount = 200001 where reference_number='OPE-MON-20260101-000000-2939F6DE'" >/dev/null
o=$(printf '%s\n' "$CEO" "$PW" | bash "$S" andika 2>&1); ok "A3 row imebadilika -> SIMAMA" '[[ "$o" == *"hali imebadilika"* ]] && [ "$(nj)" = "$n0" ]'
q "update capital_expenditure set amount = 200000 where reference_number='OPE-MON-20260101-000000-2939F6DE'" >/dev/null
C0=$(dc 1000); E0=$(dc 6200); T0=$(tb)
o=$(printf '%s\n' "$CEO" "$PW" | bash "$S" andika 2>&1); echo "$o" | tail -5
ok "W1 andika: 1000 +200,000, 6200 -200,000, TB haijabadilika" '[[ "$o" == *"---88_MWISHO---"* ]] && [ "$(q "select ($(dc 1000))::numeric - ($C0)::numeric")" = 200000.00 ] && [ "$(q "select ($(dc 6200))::numeric - ($E0)::numeric")" = -200000.00 ] && [ "$(tb)" = "$T0" ]'
ok "W2 journal: tarehe ya leo, maelezo ASCII" '[ "$(q "select count(*) from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_number='"'"'MAREKEBISHO-88-FRAME-JAN'"'"' and e.entry_date=current_date and l.description like '"'"'Marekebisho: Frame Jan 2026 mara ya 3%hatua 88)'"'"' and octet_length(l.description)=length(l.description)")" = 2 ]'
n1=$(nj); o=$(printf '%s\n' "$CEO" "$PW" | bash "$S" andika 2>&1); ok "W3 mara ya pili -> IPO TAYARI, hakuna journal mpya" '[[ "$o" == *"IPO TAYARI"* ]] && [ "$(nj)" = "$n1" ]'
o=$(bash "$S" kagua 2>&1); ok "K2 kagua baada: journal ya 88 = 1" '[[ "$o" == *"journal ya 88 tayari: 1"* ]]'
echo "MWISHO PASS $P FAIL $F"
