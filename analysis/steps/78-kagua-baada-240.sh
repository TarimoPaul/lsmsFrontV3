#!/usr/bin/env bash
# HATUA 78 (mmiliki 09/11 dl) - PROD, KUSOMA TU, asubuhi ya 10/11 baada ya deploy ya 2.4.0 + 3.2.0 (09/11 14:03).
# 1 gl_posting_failure tangu deploy  2 LOANINT ya 10/11  3 "Muhtasari wa Mauzo" (nani, faida au la)
# 4 login_audit saa 24 za kwanza     5 ERROR kwenye log ya backend tangu deploy
set -u
cd /home/chief/lsms-deployment || { echo "HAIPO lsms-deployment"; exit 1; }
DEPZ='2026-11-09 13:55+03'   # timestamptz (login_audit.at)
DEP='2026-11-09 13:55'   # timestamp ya JVM (EAT): created_at; deploy ilianza 14:02, backend 2.4.0 14:03 (EAT)
q() { docker compose exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F " | " -c "$SQL"' < /dev/null; }
echo "=== 0 HALI"
docker compose ps --format '{{.Service}} {{.Image}} {{.Status}}' < /dev/null
echo "flyway_max $(q "select max(version::int) from flyway_schema_history where success and version ~ '^[0-9]+\$'")"
echo "=== 1 GL_POSTING_FAILURE tangu $DEP (zote / hazijatatuliwa)"
q "select count(*), count(*) filter (where resolved_at is null) from gl_posting_failure where created_at >= '$DEP'"
q "select created_at::timestamp(0), source_type, event_type, entry_date, attempts, coalesce(resolution,'-'), left(error,140) from gl_posting_failure where created_at >= '$DEP' order by id limit 20"
echo "=== 2 LOANINT 10/11 (riba ya mkopo ya siku)"
q "select e.reference_uid, e.entry_date, e.status, e.total_debit, (select string_agg(l.account_code||':'||(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0))::numeric(19,0), ',' order by l.account_code) from journal_entry_line l where l.journal_entry_uid=e.uid) from journal_entry e where e.reference_uid like 'LOANINT:%:2026-11-10' order by e.id"
echo "LOANINT 10/11 idadi: $(q "select count(*) from journal_entry where reference_uid like 'LOANINT:%:2026-11-10'") | 09/11: $(q "select count(*) from journal_entry where reference_uid like 'LOANINT:%:2026-11-09'") (09/11 na 10/11 zinapaswa kuwa sawa: mkopo mmoja = journal moja kwa siku)"
q "select count(*), string_agg(distinct left(error,120), ' ; ') from gl_posting_failure where reference_uid like 'LOANINT:%' and created_at >= '$DEP'"
echo "=== 3 MUHTASARI WA MAUZO (DAILY_SALES_SUMMARY) tangu $DEP"
q "select n.created_at::timestamp(0), n.summary_date, coalesce(u.first_name||' '||u.last_name, u.email, n.recipient_user_uid) as mpokeaji, coalesce((select string_agg(r.name, ',') from user_roles ur join roles r on r.uid=ur.role_uid where ur.user_uid=u.uid),'?') as roles, case when n.total_profit is null then 'MAUZO TU' else 'INA FAIDA' end, n.total_count, n.total_amount, n.is_read from notifications n left join users u on u.uid=n.recipient_user_uid where n.type='DAILY_SALES_SUMMARY' and n.created_at >= '$DEP' order by n.id" 2>&1
echo "=== 4 LOGIN_AUDIT saa 24 za kwanza"
q "select event, result, count(*) from login_audit where at >= '$DEPZ' group by 1,2 order by 3 desc"
q "select coalesce(email_attempted,'-'), result, coalesce(failure_reason,'-'), count(*), max(at)::timestamp(0) from login_audit where at >= '$DEPZ' and result <> 'SUCCESS' group by 1,2,3 order by 4 desc limit 15"
q "select network_flag, coalesce(country,'-'), count(*), count(*) filter (where new_device) as kifaa_kipya, string_agg(distinct coalesce(alert,''), ',') from login_audit where at >= '$DEPZ' group by 1,2 order by 3 desc limit 15"
echo "=== 5 ERROR kwenye log ya backend tangu deploy"
L=$(docker compose logs --no-log-prefix --since '2026-11-09T11:03:00Z' backend < /dev/null 2>&1)
echo "mistari $(wc -l <<<"$L") | ERROR $(grep -c ' ERROR ' <<<"$L") | WARN $(grep -c ' WARN ' <<<"$L") | Exception $(grep -c 'Exception' <<<"$L")"
grep ' ERROR ' <<<"$L" | sed -E 's/^[0-9T:.+-]+ +//; s/[0-9a-f]{8}-[0-9a-f-]{27}/<uid>/g; s/[0-9]+/N/g' | cut -c1-200 | sort | uniq -c | sort -rn | head -15
echo "=== 6 SCHEDULER za usiku (00:05 / 02:00)"
grep -E 'LoanInterest|DailySales|Muhtasari|backup|Scheduler' <<<"$L" | grep -E ' (INFO|WARN|ERROR) ' | cut -c1-200 | tail -12
ls -la /home/chief/backups/daily/ | tail -2
echo "=== 7 (du) INVENTORY: GL 1200 vs daftari (Health: tofauti 1,417 leo; 02/11 ilikuwa -8.77). KUSOMA TU - Chief asibofye Correct"
S='2026-11-02'
echo "--- 7a jumla: GL 1200 | daftari (stock x avg, avg>0) | bidhaa zenye stock lakini avg<=0 (zinatumia gharama mbadala)"
q "select (select coalesce(sum(l.debit_amount-l.credit_amount),0)::numeric(19,2) from journal_entry_line l join journal_entry e on e.uid=l.journal_entry_uid where l.account_code='1200' and e.status='POSTED'),
          (select coalesce(sum(p.current_stock*p.current_average_cost),0)::numeric(19,2) from products p where coalesce(p.is_deleted,false)=false and p.current_stock>0 and p.current_average_cost>0),
          (select count(*)||' bidhaa, stock x last_purchase_cost = '||coalesce(sum(p.current_stock*coalesce(p.last_purchase_cost,0)),0)::numeric(19,2) from products p where coalesce(p.is_deleted,false)=false and p.current_stock>0 and coalesce(p.current_average_cost,0)<=0)"
q "select p.product_name, p.current_stock, p.current_average_cost, p.last_purchase_cost, p.last_cost_update::date from products p where coalesce(p.is_deleted,false)=false and p.current_stock>0 and coalesce(p.current_average_cost,0)<=0 order by 2 desc limit 15"
echo "--- 7b GL 1200 tangu $S kwa siku na aina (Dr-Cr)"
q "select e.entry_date, e.reference_type, case when coalesce(e.is_reversal,false) then 'REV' else '' end, count(distinct e.uid), sum(l.debit_amount-l.credit_amount)::numeric(19,2)
   from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where l.account_code='1200' and e.status='POSTED' and e.entry_date >= '$S' group by 1,2,3 order by 1,2,3"
echo "--- 7c ununuzi ULIOFUTWA tangu $S (K1/K2): ref | bidhaa | kiasi | ilifutwa | journal 1200 (asili+reversal) | avg sasa | last_purchase_cost"
q "select pu.uid, pr.product_name, pu.total_amount, pu.cancellation_date::timestamp(0), coalesce(pu.cancellation_reason,'-'),
   (select string_agg(e.entry_date||case when coalesce(e.is_reversal,false) then ' REV ' else ' ' end||(l.debit_amount-l.credit_amount)::numeric(19,2), ' ; ' order by e.id) from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where e.reference_uid=pu.uid and l.account_code='1200'),
   pr.current_average_cost, pr.last_purchase_cost
   from purchases pu join products pr on pr.uid=pu.product_uid where pu.status='CANCELLED' and pu.cancellation_date >= '$S' order by pu.cancellation_date"
echo "--- 7d kila SALE tangu $S: Cr 1200 ya journal vs gharama ya mistari (sum total_cost; na piece x cost_per_piece) - zenye tofauti >= 1"
q "with s as (select e.reference_uid su, sum(l.credit_amount-l.debit_amount) cr from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid
     where l.account_code='1200' and e.status='POSTED' and not coalesce(e.is_reversal,false) and e.reference_type like 'SALE%' and e.entry_date >= '$S' group by 1),
   d as (select sd.sale_uid su, sum(coalesce(sd.total_cost,0)) tc, sum(coalesce(sd.piece_quantity,0)*coalesce(sd.cost_per_piece,0)) pc from sales_details sd group by 1)
   select count(*), sum(s.cr - d.tc)::numeric(19,2) as cr_minus_totalcost, sum(s.cr - d.pc)::numeric(19,2) as cr_minus_pieces_x_cost from s join d on d.su=s.su where abs(s.cr - d.pc) >= 1"
q "with s as (select e.reference_uid su, sum(l.credit_amount-l.debit_amount) cr from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid
     where l.account_code='1200' and e.status='POSTED' and not coalesce(e.is_reversal,false) and e.reference_type like 'SALE%' and e.entry_date >= '$S' group by 1)
   select pr.product_name, count(distinct s.su), sum(sd.piece_quantity), min(sd.cost_per_piece), max(sd.cost_per_piece), pr.current_average_cost
   from s join sales_details sd on sd.sale_uid=s.su join products pr on pr.uid=sd.product_uid
   where abs(s.cr - (select sum(coalesce(x.piece_quantity,0)*coalesce(x.cost_per_piece,0)) from sales_details x where x.sale_uid=s.su)) >= 1
   group by pr.product_name, pr.current_average_cost order by 2 desc limit 20"
echo "--- 7e sale zilizofutwa tangu $S: Dr 1200 ya reversal vs Cr 1200 ya asili (zinapaswa kulingana)"
q "select count(*), sum(r.amt + o.amt)::numeric(19,2) from
   (select e.reference_uid su, sum(l.debit_amount-l.credit_amount) amt from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where l.account_code='1200' and e.is_reversal and e.reference_type like 'SALE%' and e.entry_date >= '$S' group by 1) r
   join (select e.reference_uid su, sum(l.debit_amount-l.credit_amount) amt from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid where l.account_code='1200' and not coalesce(e.is_reversal,false) and e.reference_type like 'SALE%' group by 1) o on o.su=r.su"
echo "--- 7f marekebisho ya stock (counting) tangu $S: thamani vs GL"
q "select count(*), coalesce(sum(adjustment_value),0)::numeric(19,2), count(*) filter (where not coalesce(gl_posted,false)) as bila_gl from stock_adjustment where created_at >= '$S'"
echo "--- 7g mwendo wa store tangu $S kwa aina (idadi, vipande)"
q "select movement_type, count(*), sum(quantity) from store where movement_date >= '$S' and coalesce(is_deleted,false)=false group by 1 order by 2 desc"
echo "--- 7h bidhaa ambazo avg imebadilika tangu $S: idadi"
q "select count(*) from products where last_cost_update >= '$S'"
echo "---78_SERVER_MWISHO---"
