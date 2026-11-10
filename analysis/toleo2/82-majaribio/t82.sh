#!/usr/bin/env bash
# Majaribio ya hatua 82 kwenye Docker-local (image ya prod 2.4.0, nakala ya 29/10, PG15). Inaandika kwenye nakala tu.
S="/d/MY PROJECT/DUKA PROJECT/LsmsVersion3/lsmsFrontV3/analysis/steps/82-lipa-deni.sh"
export L82_DIR="/d/MY PROJECT/DUKA PROJECT/Lsms/Lsms-t2/deploy/local" L82_PROJ=lsms-local L82_BASE=http://127.0.0.1:18090
CEO=tarimo@gmail.com; PW='T82-Jaribio-Local-2026'
q(){ docker exec -i lsms-local-postgres-1 psql -U postgres -d Lsms -At -F '|' -c "$1"; }
P=0; F=0; ok(){ if eval "$2"; then P=$((P+1)); echo "PASS $1"; else F=$((F+1)); echo "FAIL $1"; fi; }
run(){ local mode=$1; shift; printf '%s\n' "$@" | bash "$S" "$mode" 2>&1; }
bal(){ q "select coalesce(sum(coalesce(l.credit_amount,0)-coalesce(l.debit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code='$1' and e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
tb(){ q "select coalesce(sum(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0)),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)"; }
lines(){ q "select string_agg(l.account_code||':'||(l.debit_amount-l.credit_amount)::numeric(19,0), ',' order by l.account_code) from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_number like '%$1%'"; }
HASH=$(python -c "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())" "$PW")
q "update users set password='$HASH', status='ACTIVE', is_locked=false where email='$CEO'" >/dev/null
q "update gl_config set bank_cutover_date=null" >/dev/null
TODAY=$(date +%F); D=${TODAY//-/}

o=$(bash "$S" kagua 2>&1); ok "K1 kagua inaendesha, inaonyesha cutover HAIJAWEKWA na alama ya dharura" '[[ "$o" == *"---82_KAGUA_MWISHO---"* && "$o" == *"HAIJAWEKWA"* && "$o" == *DHARURA* ]]'
o=$(run andika 2400 1000 DROO "" "Pango la Frame jaribio la mwanzo" "$CEO" "$PW"); ok "K2 2400 haipo kwenye chart -> SIMAMA" '[[ "$o" == *"haipo kwenye chart"* && "$o" == *"---82_IMESHINDWA---"* ]]'

# hali ya prod baada ya 80b/80e: 2400 ipo na deni 600,000; TRA 2200 +65,000
q "insert into gl_account (uid, account_code, account_name, account_name_sw, account_type, account_category, normal_balance, is_active, is_system, sort_order, description)
   values (gen_random_uuid(), '2400', 'Accrued Expenses', 'Gharama Zinazodaiwa', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', true, true, 2400, 'jaribio 82') on conflict (account_code) do nothing" >/dev/null
TOK=$(curl -s -X POST -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' --data "{\"email\":\"$CEO\",\"password\":\"$PW\"}" $L82_BASE/api/auth/login | sed -n 's/.*"token" *: *"\([^"]*\)".*/\1/p' | head -1)
mjr(){ curl -s -X POST -H 'Content-Type: application/json' -H 'Host: elikom.co.tz' -H "Authorization: Bearer $TOK" --data "{\"entryDate\":\"$TODAY\",\"memo\":\"$4\",\"lines\":[{\"accountCode\":\"$1\",\"debit\":$3,\"credit\":0,\"description\":\"$4\"},{\"accountCode\":\"$2\",\"debit\":0,\"credit\":$3,\"description\":\"$4\"}]}" $L82_BASE/api/v1/gl/journal-entries/manual; }
mjr 6000 2400 600000 "T82 accrual pango" >/dev/null; mjr 6800 2200 65000 "T82 accrual TRA" >/dev/null
B24=$(bal 2400); B22=$(bal 2200); ok "S1 deni la jaribio: 2400 = 600,000" '[ "$B24" = 600000.00 ]'

o=$(run angalia 2400 600000.01 DROO "" "Pango la Frame Okt-Des 2026"); ok "A1 zaidi ya deni -> kataa" '[[ "$o" == *kinazidi* && "$o" == *IMESHINDWA* ]]'
o=$(run angalia 2400 1000 DROO "" "aaaaaaaaaaaaaa"); ok "A2 maelezo takataka -> kataa" '[[ "$o" == *"hayaeleweki"* ]]'
o=$(run angalia 2400 1000 DROO "" "fupi"); ok "A3 maelezo mafupi -> kataa" '[[ "$o" == *"angalau herufi 10"* ]]'
o=$(run angalia 6000 1000 DROO "" "Pango la Frame Okt-Des 2026"); ok "A4 akaunti ya gharama 6000 -> kataa" '[[ "$o" == *"lazima iwe 2400"* ]]'
o=$(run angalia 2400 1000 BENKI "" "Pango la Frame Okt-Des 2026"); ok "A5 BENKI bila akaunti -> kataa" '[[ "$o" == *"1020..1024"* ]]'
o=$(run angalia 2400 1000 SIMU 1021 "Pango la Frame Okt-Des 2026"); ok "A6 SIMU na akaunti ya benki -> kataa" '[[ "$o" == *"1030..1033"* ]]'
o=$(run angalia 2400 1,000 DROO "" "Pango la Frame Okt-Des 2026"); ok "A7 kiasi chenye koma -> kataa" '[[ "$o" == *"si sahihi"* ]]'
n0=$(q "select count(*) from journal_entry")
o=$(run angalia 2400 400000 BENKI 1021 "Pango la Frame Okt-Nov 2026"); ok "A8 angalia: cutover haijawekwa -> Cr 1000, hakuna kilichoandikwa" '[[ "$o" == *"Cr 1000 400000"* && "$o" == *"---82_ANGALIA_MWISHO---"* && "$(q "select count(*) from journal_entry")" = "$n0" ]]'
o=$(run andika 2400 400000 BENKI 1021 "Pango la Frame Okt-Nov 2026" "$CEO" "nenosiri-baya"); ok "A9 password mbaya -> SIMAMA, hakuna journal" '[[ "$o" == *"login HTTP"* && "$(q "select count(*) from journal_entry")" = "$n0" ]]'

T0=$(tb)
o=$(run andika 2400 400000 BENKI 1021 "Pango la Frame Okt-Nov 2026" "$CEO" "$PW"); echo "$o" | tail -4
ok "W1 andika: Dr 2400 / Cr 1000 400,000, TB haijabadilika, 2400 = 200,000" '[[ "$o" == *"---82_MWISHO---"* ]] && [ "$(lines DENI82-2400-$D-400000)" = "1000:-400000,2400:400000" ] && [ "$(tb)" = "$T0" ] && [ "$(bal 2400)" = 200000.00 ]'
n1=$(q "select count(*) from journal_entry")
o=$(run andika 2400 400000 BENKI 1021 "Pango la Frame Okt-Nov 2026" "$CEO" "$PW"); ok "W2 kurudia -> TAYARI IPO, hakuna journal ya pili" '[[ "$o" == *"TAYARI IPO"* ]] && [ "$(q "select count(*) from journal_entry")" = "$n1" ]'
q "update gl_config set bank_cutover_date = current_date - 5" >/dev/null
o=$(run andika 2400 150000 BENKI 1021 "Pango la Frame Desemba 2026" "$CEO" "$PW"); ok "W3 baada ya cutover: Cr 1021 (NMB)" '[ "$(lines DENI82-2400-$D-150000)" = "1021:-150000,2400:150000" ] && [ "$(bal 2400)" = 50000.00 ]'
o=$(run andika 2200 65000 MMILIKI "" "TRA mwaka 2026 imelipwa na Chief" "$CEO" "$PW"); ok "W4 MMILIKI -> Cr 2300, 2200 imepungua 65,000" '[ "$(lines DENI82-2200-$D-65000)" = "2200:65000,2300:-65000" ] && [ "$(q "select ($(bal 2200))::numeric = ($B22)::numeric - 65000")" = t ]'
o=$(run andika 2400 50000 DROO "" "Pango la Frame salio la mwisho" "$CEO" "$PW"); ok "W5 DROO hata baada ya cutover -> Cr 1000; deni 0" '[ "$(lines DENI82-2400-$D-50000)" = "1000:-50000,2400:50000" ] && [ "$(bal 2400)" = 0.00 ]'
o=$(run angalia 2400 40000 DROO "" "Pango la Frame kiasi kingine"); ok "W5b alama: 40000 haichanganywi na 400000 (inaenda kwenye ukaguzi wa salio)" '[[ "$o" != *"TAYARI IPO"* && "$o" == *kinazidi* ]]'
o=$(run angalia 2400 1 DROO "" "Pango la Frame shilingi moja"); ok "W6 deni 0 -> hata 1 inakataliwa" '[[ "$o" == *kinazidi* ]]'
q "insert into gl_period (uid, period_year, period_month, status) values (gen_random_uuid()::text, extract(year from current_date), extract(month from current_date), 'CLOSED')" >/dev/null
o=$(run angalia 2200 1000 DROO "" "TRA jaribio la kipindi"); ok "W7 kipindi kimefungwa -> kataa" '[[ "$o" == *"kimefungwa"* ]]'
q "delete from gl_period where period_year=extract(year from current_date) and period_month=extract(month from current_date) and status='CLOSED' and period_name is null" >/dev/null
q "update gl_config set bank_cutover_date=null" >/dev/null
o=$(bash "$S" kagua 2>&1); ok "K3 kagua inaorodhesha journal 4 za 82" '[ "$(echo "$o" | grep -c "DENI82-")" = 4 ]'
echo "MWISHO PASS $P FAIL $F"
