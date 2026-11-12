#!/usr/bin/env bash
# Majaribio ya hatua 89 kwenye Docker-local (backend t2-ripoti, V145, nakala ya 29/10). Rows za Nov za prod hazipo
# kwenye 29/10: zinaundwa hapa kwa namba zilezile (nakala ya kutupa tu), na journal ya kweli ya 6000 / 1000.
S="/d/MY PROJECT/DUKA PROJECT/LsmsVersion3/lsmsFrontV3/analysis/steps/89-nje-ya-ripoti.sh"
export L89_DIR="/d/MY PROJECT/DUKA PROJECT/Lsms/Lsms-t2-ripoti/deploy/local" L89_PROJ=lsms-local L89_BASE=http://127.0.0.1:18090
CEO=tarimo@gmail.com; PW='T89-Jaribio-Local-2026'
q(){ docker exec -i lsms-local-postgres-1 psql -U postgres -d Lsms -At -F '|' -c "$1"; }
P=0; F=0; ok(){ if eval "$2"; then P=$((P+1)); echo "PASS $1"; else F=$((F+1)); echo "FAIL $1"; fi; }
HASH=$(python -c "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())" "$PW")
q "update users set password='$HASH', status='ACTIVE', is_locked=false where email='$CEO'" >/dev/null
for x in "REN-MON-20261101-000000-5D9DD844|200000|Malipo Ya Kodi YA Frame (2026-11)" "TAX-MON-20261101-000000-B4F8EA66|250000|Malipo Ya TRA (2026-11)"; do
  IFS='|' read -r ref amt d <<< "$x"
  q "delete from capital_expenditure where reference_number='$ref'" >/dev/null
  q "insert into capital_expenditure (uid, created_at, is_active, is_deleted, capital_type, expenditure_type, expenditure_frequency, source, amount, description, transaction_date,
       reference_number, is_from_product_capital, affects_daily_profit, is_asset, salvage_value, accumulated_depreciation, is_recurring, recurring_active, is_approved, status,
       allocated_year, allocated_month, payment_method)
     select gen_random_uuid()::text, now(), true, false, capital_type, 'MONTHLY_EXPENSE', expenditure_frequency, source, $amt, '$d', '2026-11-01 00:00', '$ref', false, false, false, 0, 0,
       false, true, true, 'APPROVED', 2026, 11, 'CASH' from capital_expenditure where reference_number='OPE-MON-20260101-000000-F7C9E331'" >/dev/null
done
o=$(bash "$S" kagua 2>&1); echo "$o" > /tmp/t89-kagua.out
ok "K1 kagua: V145 = 1, rows 3 (pamoja na 2939F6DE ya 88) zinaonekana, bado ndani ya ripoti" '[[ "$o" == *"V145 (exclude_from_ops_report): 1"* && "$o" == *5D9DD844*"| f |"* && "$o" == *B4F8EA66* && "$o" == *2939F6DE*"| 200000 | MONTHLY_EXPENSE | f |"* && "$o" == *"2939F6DE - sababu "*"hatua 88"* && "$o" == *"---89_KAGUA_MWISHO---"* ]]'
o=$(printf '%s\n' "$CEO" "nenosiri-baya" | bash "$S" andika 2>&1); ok "A1 password mbaya -> SIMAMA, hakuna alama" '[[ "$o" == *"login HTTP"* ]] && [ "$(q "select count(*) from capital_expenditure where exclude_from_ops_report")" = 0 ]'
o=$(L89_ZAIDI=HAKUNA-REF-HII bash -c "printf '%s\n' '$CEO' '$PW' | bash '$S' andika" 2>&1); ok "A2 ref isiyokuwepo -> SIMAMA kabla ya kuandika chochote" '[[ "$o" == *"HAKUNA-REF-HII"*IMESHINDWA* ]] && [ "$(q "select count(*) from capital_expenditure where exclude_from_ops_report")" = 0 ]'
TB0=$(q "select round(sum(l.debit_amount-l.credit_amount),2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='POSTED' and not coalesce(e.is_deleted,false)")
o=$(printf '%s\n' "$CEO" "$PW" | bash "$S" andika 2>&1); echo "$o" | tail -4
ok "W1 andika: rows 2 nje ya ripoti, sababu 'zimeshughulikiwa na hatua 80', GL ileile" '[[ "$o" == *"---89_MWISHO---"* ]] && [ "$(q "select count(*) from capital_expenditure where exclude_from_ops_report and reference_number in ('"'"'REN-MON-20261101-000000-5D9DD844'"'"','"'"'TAX-MON-20261101-000000-B4F8EA66'"'"')")" = 2 ] && [ "$(q "select count(*) from capex_ops_report_exclusion_log where reason='"'"'zimeshughulikiwa na hatua 80'"'"'")" = 2 ]'
ok "W1b 2939F6DE nje ya ripoti, sababu ya hatua 88" '[ "$(q "select count(*) from capex_ops_report_exclusion_log x join capital_expenditure c on c.uid=x.capex_uid where c.reference_number='"'"'OPE-MON-20260101-000000-2939F6DE'"'"' and c.exclude_from_ops_report and x.reason='"'"'imeshughulikiwa na hatua 88 (Frame Jan 2026 mara ya 2)'"'"'")" = 1 ]'
o=$(printf '%s\n' "$CEO" "$PW" | bash "$S" andika 2>&1); ok "W2 mara ya pili: zinarukwa, hakuna log mpya" '[[ "$o" == *"tayari iko nje"* && "$o" == *"---89_MWISHO---"* ]] && [ "$(q "select count(*) from capex_ops_report_exclusion_log")" = 3 ]'
ok "W3 TB haijabadilika" '[ "$(q "select round(sum(l.debit_amount-l.credit_amount),2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where e.status='"'"'POSTED'"'"' and not coalesce(e.is_deleted,false)")" = "$TB0" ]'
echo "MWISHO PASS $P FAIL $F"
