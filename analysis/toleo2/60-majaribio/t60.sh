#!/usr/bin/env bash
# Majaribio ya hatua 60 (ufunguzi + D) kwenye Docker-local: nakala safi ya dump 29/10, backend t2-cutover 7140df4 (Flyway 150).
# (fg) tofauti ya pesa taslimu -> 2910 'Tofauti ya ufunguzi' (akaunti ya muda), bila uamuzi wa kuandika.
# (fj) akaunti ZOTE 9 za benki/simu zinapata salio la ufunguzi (CRDB 25,000 hapa; nyingine zisizotajwa = 0).
# Nakala ya kutupa tu. D = leo (journal haiwezi kuwa ya baadaye).
S="/d/MY PROJECT/DUKA PROJECT/LsmsVersion3/lsmsFrontV3/analysis/steps/60-ufunguzi.sh"
export L60_DIR="/d/MY PROJECT/DUKA PROJECT/Lsms/Lsms-t2-hesabu/deploy/local" L60_PROJ=lsms-local L60_BASE=http://127.0.0.1:18090
CEO=tarimo@gmail.com; PW='T60-Jaribio-Local-2026'
q(){ docker exec -i lsms-local-postgres-1 psql -U postgres -d Lsms -At -F '|' -c "$1"; }
P=0; F=0; ok(){ if eval "$2"; then P=$((P+1)); echo "PASS $1"; else F=$((F+1)); echo "FAIL $1"; echo "$o" | tail -6; fi; }
LIVE="e.status='POSTED' and not coalesce(e.is_deleted,false)"
dc(){ q "select coalesce(sum(l.debit_amount-l.credit_amount),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code='$1' and $LIVE"; }
tb(){ q "select coalesce(sum(l.debit_amount-l.credit_amount),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where $LIVE"; }
nj(){ q "select count(*) from journal_entry"; }
cut(){ q "select coalesce(bank_cutover_date::text,'') from gl_config"; }
HASH=$(python -c "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())" "$PW")
q "update users set password='$HASH', status='ACTIVE', is_locked=false where email='$CEO'" >/dev/null
q "update gl_config set bank_cutover_date=null, posting_enabled=true" >/dev/null
TODAY=$(date +%F)
export L60_D=$TODAY L60_NMB=1500000 L60_SELCOM=300000 L60_MPESA=200000 L60_TIGO=50000 L60_CRDB=25000 L60_TASLIMU=900000 L60_BAHASHA=120000
run(){ printf '%s\n' "$CEO" "${1:-$PW}" | bash "$S" andika 2>&1; }
T0=$(tb); C1000=$(dc 1000); C1030=$(dc 1030); C1021=$(dc 1021); C1023=$(dc 1023); C1031=$(dc 1031)
C1020=$(dc 1020); C1022=$(dc 1022); C1024=$(dc 1024); C1032=$(dc 1032); C1033=$(dc 1033)
MOVE="((1500000-($C1021))+(300000-($C1023))+(200000-($C1030))+(50000-($C1031))+(25000-($C1020))-($C1022)-($C1024)-($C1032)-($C1033))"

o=$(bash "$S" kagua 2>&1); echo "$o" > /tmp/t60-kagua.out
DIFF=$(echo "$o" | sed -n 's/^TOFAUTI_YA_UFUNGUZI \([-0-9.]*\).*/\1/p')
ok "K1 kagua: akaunti 4, 1030 ya kabla ($C1030) inawekwa = halisi, tofauti -> 2910, MWISHO" '[[ "$o" == *"1030 MPESA: GL $C1030 -> halisi 200000 -> journal"* && "$o" == *"1021 NMB: GL $C1021 -> halisi 1500000"* && -n "$DIFF" && "$o" == *"1000 / 2910 Tofauti ya ufunguzi"* && "$o" == *"1020 CRDB: GL $C1020 -> halisi 25000"* && "$o" == *"1033 AIRTEL: GL $C1033 -> halisi 0"* && "$o" == *"akaunti ZOTE 9"* && "$o" == *"---60_KAGUA_MWISHO---"* ]]'
ok "K2 tofauti = taslimu - (1000 - benki/simu mpya)" '[ "$(q "select (900000 - (($C1000) - $MOVE))::numeric(19,2) = $DIFF")" = t ]'
n0=$(nj)
q "update gl_account set is_active=false where account_code='2910'" >/dev/null
o=$(run); ok "A1 2910 haitumiki (V150 haijafika) -> SIMAMA, hakuna journal, D haijawekwa" '[[ "$o" == *"2910 Tofauti ya ufunguzi haipo"* && "$o" == *"---60_IMESHINDWA---"* ]] && [ "$(nj)" = "$n0" ] && [ -z "$(cut)" ]'
q "update gl_account set is_active=true where account_code='2910'" >/dev/null
o=$(L60_D=$(date -d "$TODAY -1 day" +%F) run); ok "A2 D si leo -> SIMAMA" '[[ "$o" == *"lazima iwe LEO"* ]] && [ "$(nj)" = "$n0" ] && [ -z "$(cut)" ]'
o=$(run nenosiri-baya); ok "A3 password mbaya -> SIMAMA" '[[ "$o" == *"login HTTP"* ]] && [ "$(nj)" = "$n0" ] && [ -z "$(cut)" ]'
o=$(L60_TASLIMU=abc run); ok "A4 kiasi si halali -> SIMAMA" '[[ "$o" == *"L60_TASLIMU si kiasi"* ]] && [ "$(nj)" = "$n0" ]'
# A6: journal ya pesa ya leo (si mauzo) ipo -> SIMAMA (ingeandikwa kwa kanuni ya kabla ya D)
TK=$(curl -s -X POST -H 'Content-Type: application/json' -H 'Origin: https://elikom.co.tz' --data "{\"email\":\"$CEO\",\"password\":\"$PW\"}" http://127.0.0.1:18090/api/auth/login | sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' | head -1)
curl -s -o /dev/null -X POST -H 'Content-Type: application/json' -H 'Origin: https://elikom.co.tz' -H "Authorization: Bearer $TK" \
  --data "{\"entryDate\":\"$TODAY\",\"memo\":\"T60-A6 gharama ya leo\",\"lines\":[{\"accountCode\":\"6130\",\"debit\":1000,\"credit\":0},{\"accountCode\":\"1000\",\"debit\":0,\"credit\":1000}]}" \
  http://127.0.0.1:18090/api/v1/gl/journal-entries/manual
n1=$(nj); o=$(run); ok "A6 journal ya pesa ya siku D ipo -> SIMAMA" '[[ "$o" == *"kuna journal 1 za pesa za siku D"* ]] && [ "$(nj)" = "$n1" ] && [ -z "$(cut)" ]'
q "update journal_entry set is_deleted=true where reference_number='T60-A6 gharama ya leo'" >/dev/null
T0=$(tb)

o=$(run); echo "$o" | tail -10
ok "W1 andika: D = leo, akaunti = halisi, 1000 = taslimu 900,000, 2910 = tofauti, TB ileile" '[[ "$o" == *"journal ya ufunguzi SAWA"* && "$o" == *"journal ya tofauti SAWA"* && "$o" == *"2910 Tofauti ya ufunguzi: $DIFF"* && "$o" == *"---60_MWISHO---"* ]] && [ "$(cut)" = "$TODAY" ] && [ "$(dc 1021)" = 1500000.00 ] && [ "$(dc 1023)" = 300000.00 ] && [ "$(dc 1030)" = 200000.00 ] && [ "$(dc 1031)" = 50000.00 ] && [ "$(dc 1020)" = 25000.00 ] && [ "$(dc 1022)" = 0.00 ] && [ "$(dc 1032)" = 0.00 ] && [ "$(dc 1033)" = 0.00 ] && [ "$(dc 1000)" = 900000.00 ] && [ "$(q "select (-($(dc 2910)))::numeric(19,2) = ($DIFF)::numeric(19,2)")" = t ] && [ "$(tb)" = "$T0" ]'
ok "W2 journal 2 (UFUNGUZI-60, UFUNGUZI-60-TOFAUTI kwenda 2910 tu), tarehe D" '[ "$(q "select count(*) from journal_entry e where e.reference_number in ('"'"'UFUNGUZI-60'"'"','"'"'UFUNGUZI-60-TOFAUTI'"'"') and e.entry_date=date '"'"'$TODAY'"'"' and $LIVE")" = 2 ] && [ "$(q "select string_agg(distinct l.account_code,'"'"','"'"' order by l.account_code) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.reference_number='"'"'UFUNGUZI-60-TOFAUTI'"'"' and $LIVE")" = "1000,2910" ]'
ok "W3 3900 haijaguswa na hatua 60" '[ "$(q "select count(*) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.reference_number like '"'"'UFUNGUZI-60%'"'"' and l.account_code='"'"'3900'"'"'")" = 0 ]'
n2=$(nj); o=$(run); ok "W4 mara ya pili: ufunguzi unarukwa, CUTOVER_TAYARI, hakuna journal mpya" '[[ "$o" == *"IPO TAYARI"* && "$o" == *"CUTOVER_TAYARI"*"---60_MWISHO---"* || "$o" == *"IPO TAYARI"*"---60_MWISHO---"* ]] && [ "$(nj)" = "$n2" ]'
# (fe) baada ya D: Selcom -> NMB 300k ada 2k kupitia API ya uhamisho
r=$(curl -s -X POST -H 'Content-Type: application/json' -H 'Origin: https://elikom.co.tz' -H "Authorization: Bearer $TK" \
  --data "{\"fromAccount\":\"1023\",\"toAccount\":\"1021\",\"amount\":300000,\"fee\":2000,\"date\":\"$TODAY\",\"reason\":\"Selcom kwenda NMB kulipa wasambazaji\"}" http://127.0.0.1:18090/api/v1/gl/transfers)
ok "W5 (fe) baada ya ufunguzi: Selcom 300k -> NMB ada 2k: 1023 = 0, 1021 = 1,798,000, TB 0" '[[ "$r" == *Success* ]] && [ "$(dc 1023)" = 0.00 ] && [ "$(dc 1021)" = 1798000.00 ] && [ "$(tb)" = "$T0" ]'

# W6: taslimu = vitabu (tofauti 0): nakala ileile, journal za ufunguzi na uhamisho vinafutwa (local tu) na D inaondolewa
q "update journal_entry set is_deleted=true where reference_number like 'UFUNGUZI-60%' or reference_type='FUNDS_TRANSFER' and entry_date=date '$TODAY'" >/dev/null
q "update gl_config set bank_cutover_date=null" >/dev/null
EXACT=$(q "select (($C1000) - $MOVE)::numeric(19,2)")
o=$(L60_TASLIMU=$EXACT run); echo "$o" | tail -6
ok "W6 tofauti 0 -> journal 1 tu, 2910 haiguswi, 1000 = $EXACT, D = leo, TB ileile" '[[ "$o" == *"TOFAUTI_YA_UFUNGUZI 0.00"* && "$o" != *"journal ya tofauti"* && "$o" == *"---60_MWISHO---"* ]] && [ "$(dc 1000)" = "$EXACT" ] && [ "$(dc 2910)" = 0.00 ] && [ "$(cut)" = "$TODAY" ] && [ "$(tb)" = "$T0" ]'
ok "W7 maelezo ni ASCII" '[ "$(q "select count(*) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.reference_number like '"'"'UFUNGUZI-60%'"'"' and octet_length(l.description)<>length(l.description)")" = 0 ]'
echo "MWISHO PASS $P FAIL $F"
