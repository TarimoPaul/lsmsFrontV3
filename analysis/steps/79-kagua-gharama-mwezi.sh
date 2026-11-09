#!/usr/bin/env bash
# HATUA 79 (mmiliki 09/11 dn) - PROD, KUSOMA TU: gharama za mwezi (Capital -> Expenses / Monthly budgets).
# a) OPE-MON za mbele (> leo)  b) budget zilizo STOPPED  c) nakala (jina+mwezi)  d) Malipo ya TRA  e) Kodi ya Frame
# f) athari kwenye GL kwa mwezi (2026, 2027) + vipindi vilivyofungwa. Hakuna kinachoandikwa.
set -u
cd /home/chief/lsms-deployment || { echo "HAIPO lsms-deployment"; exit 1; }
q() { docker compose exec -T -e "SQL=$1" postgres sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F " | " -c "$SQL"' < /dev/null; }
# jina la msingi: bila " (YYYY-MM)" ya mtoto, herufi ndogo
BASE="lower(trim(regexp_replace(c.description, ' [(][0-9]{4}-[0-9]{2}[)]\$', '')))"
# journal za row c: tarehe ya kitabu, status, [akaunti:kiasi]
JL="(select string_agg(e.entry_date||' '||e.status||case when coalesce(e.is_reversal,false) then ' REV' else '' end||' ['||(select string_agg(l.account_code||':'||(coalesce(l.debit_amount,0)-coalesce(l.credit_amount,0))::numeric(19,0), ',' order by l.account_code) from journal_entry_line l where l.journal_entry_uid=e.uid)||']', ' ; ' order by e.id) from journal_entry e where e.reference_uid=c.uid)"
MW="c.allocated_year||'-'||lpad(coalesce(c.allocated_month,0)::text,2,'0')"

echo "=== 0 VIPINDI (gl_period); leo $(date +%F)"
q "select period_year||'-'||lpad(period_month::text,2,'0')||' '||status||' '||coalesce(closed_at::date::text,'') from gl_period order by period_year, period_month"

echo "=== 0b TEMPLATES (MONTHLY_BUDGET): ref | maelezo | kiasi/mwezi | hai? | iliundwa | ilibadilishwa | watoto hai | mwezi wa kwanza-mwisho"
q "select t.reference_number, t.description, t.monthly_allocation_amount, t.recurring_active, t.created_at::timestamp(0), t.updated_at::timestamp(0),
   (select count(*) from capital_expenditure c where c.parent_capital_expenditure_uid=t.uid and not coalesce(c.is_deleted,false)),
   (select min(c.allocated_year*100+c.allocated_month)||'-'||max(c.allocated_year*100+c.allocated_month) from capital_expenditure c where c.parent_capital_expenditure_uid=t.uid and not coalesce(c.is_deleted,false))
   from capital_expenditure t where t.is_recurring and t.recurring_type='MONTHLY_BUDGET' and not coalesce(t.is_deleted,false) order by t.id"

echo "=== a) OPE-MON ZA MBELE (transaction_date > leo, hai): jumla, kisha kwa budget"
q "select count(*), coalesce(sum(c.amount),0) from capital_expenditure c where c.parent_capital_expenditure_uid is not null and not coalesce(c.is_deleted,false) and c.transaction_date::date > current_date"
q "select t.description, count(*), sum(c.amount), min(c.allocated_year*100+c.allocated_month), max(c.allocated_year*100+c.allocated_month),
   count(*) filter (where exists (select 1 from journal_entry e where e.reference_uid=c.uid and not coalesce(e.is_reversal,false))) as zina_journal
   from capital_expenditure c join capital_expenditure t on t.uid=c.parent_capital_expenditure_uid
   where not coalesce(c.is_deleted,false) and c.transaction_date::date > current_date group by t.description order by 2 desc"
echo "--- a2) malipo ya wafanyakazi: kila mtoto (ref | mwezi | kiasi | iliundwa | imefutwa? | journal)"
q "select c.reference_number, $MW, c.amount, c.created_at::timestamp(0), coalesce(c.is_deleted,false), coalesce($JL,'-')
   from capital_expenditure c join capital_expenditure t on t.uid=c.parent_capital_expenditure_uid
   where t.description ilike '%fanyakazi%' or t.description ilike '%mshahara%' order by t.id, c.allocated_year, c.allocated_month"

echo "=== b) BUDGET ZILIZO STOPPED: template | ilisimamishwa (updated_at) | watoto kabla/baada ya stop | hai/vimefutwa | mwezi huu"
q "select t.reference_number, t.description, t.updated_at::timestamp(0),
   count(c.uid) filter (where c.created_at <= t.updated_at), count(c.uid) filter (where c.created_at > t.updated_at),
   count(c.uid) filter (where not coalesce(c.is_deleted,false)), count(c.uid) filter (where coalesce(c.is_deleted,false)),
   string_agg(case when c.allocated_year=extract(year from current_date) and c.allocated_month=extract(month from current_date)
     then c.reference_number||' '||c.amount||case when coalesce(c.is_deleted,false) then ' (IMEFUTWA)' else ' (HAI)' end end, ',')
   from capital_expenditure t left join capital_expenditure c on c.parent_capital_expenditure_uid=t.uid
   where t.is_recurring and t.recurring_type='MONTHLY_BUDGET' and not t.recurring_active
   group by t.id, t.reference_number, t.description, t.updated_at order by t.id"
q "select t.reference_number, right(coalesce(t.notes,''), 220) from capital_expenditure t where t.is_recurring and t.recurring_type='MONTHLY_BUDGET' and not t.recurring_active order by t.id"

echo "=== c) NAKALA: zaidi ya gharama moja kwa (jina la msingi, mwezi), zilizoidhinishwa na hai"
q "select $BASE, $MW, count(*), sum(c.amount), string_agg(c.reference_number||' '||c.amount||' '||coalesce(c.expenditure_type,''), ' ; ')
   from capital_expenditure c where not coalesce(c.is_deleted,false) and c.status='APPROVED' and coalesce(c.allocated_month,0) between 1 and 12 and not coalesce(c.is_recurring,false)
   group by 1,2 having count(*) > 1 order by 1,2"
echo "--- c2) Azam / TTCL: rows zote"
q "select c.reference_number, c.description, c.expenditure_type, c.amount, $MW, c.transaction_date::date, c.status, coalesce(c.is_deleted,false), c.parent_capital_expenditure_uid is not null
   from capital_expenditure c where (c.description ilike '%azam%' or c.description ilike '%ttcl%') and not coalesce(c.is_recurring,false) and coalesce(c.expenditure_type,'') <> 'INVESTMENT' order by 2, c.allocated_year, c.allocated_month"

echo "--- c3) kwa NENO KUU na mwezi (mwezi wa gharama: allocated au transaction_date) - daily + monthly + annual pamoja; zaidi ya 1 = shaka ya nakala"
q "select k.neno, coalesce(case when coalesce(c.allocated_month,0) between 1 and 12 then $MW end, to_char(c.transaction_date,'YYYY-MM')) as mwezi,
   count(*), sum(c.amount), string_agg(c.reference_number||' '||c.expenditure_type||' '||c.amount||' \"'||left(c.description,30)||'\"', ' ; ')
   from capital_expenditure c join (values ('AZAM','azam'),('TTCL','ttcl'),('FRAME','frame'),('TRA','(^|[^a-z])tra([^a-z]|\$)')) k(neno, re) on c.description ~* k.re
   where not coalesce(c.is_deleted,false) and not coalesce(c.is_recurring,false) and c.status='APPROVED' and coalesce(c.expenditure_type,'') <> 'INVESTMENT'
   group by 1,2 having count(*) > 1 order by 1,2"

echo "=== d) MALIPO YA TRA: ref | mwezi | kiasi | iliundwa | tarehe ya gharama | imefutwa? | journal (tarehe ya kitabu, akaunti)"
q "select c.reference_number, $MW, c.amount, c.created_at::timestamp(0), c.transaction_date::date, coalesce(c.is_deleted,false), coalesce($JL,'-')
   from capital_expenditure c where c.description ~* '(^|[^a-z])tra([^a-z]|$)' order by c.id"

echo "=== e) KODI YA FRAME: rows zote (mwaka + mwezi) na journal"
q "select c.reference_number, c.description, c.expenditure_type, c.expenditure_frequency, c.amount, c.monthly_allocation_amount, $MW, c.transaction_date::date, c.status, coalesce(c.is_deleted,false), coalesce($JL,'-')
   from capital_expenditure c where c.description ilike '%frame%' order by c.id"

echo "--- e2) GHARAMA ZOTE ZA MWAKA za Flutter (dp): njia A = row moja allocated_month=0 (kiasi = jumla/12, journal mara moja);"
echo "        njia B = parent ANNUAL_EXPENSE + watoto 12. ref | maelezo | aina | kiasi | mwaka | status | journal"
q "select c.reference_number, left(c.description,70), c.expenditure_type, c.amount, c.allocated_year, c.status, coalesce(c.is_deleted,false), coalesce($JL,'-')
   from capital_expenditure c where (coalesce(c.allocated_month,-1)=0 and c.expenditure_type='MONTHLY_EXPENSE') or c.expenditure_type='ANNUAL_EXPENSE' order by c.id"
q "select p.reference_number, count(c.uid), sum(c.amount), count(*) filter (where exists (select 1 from journal_entry e where e.reference_uid=c.uid)) as zina_journal
   from capital_expenditure p join capital_expenditure c on c.parent_capital_expenditure_uid=p.uid where p.expenditure_type='ANNUAL_EXPENSE' group by p.reference_number"

echo "=== f) ATHARI KWENYE GL KWA MWEZI WA KITABU (journal za capex, si reversal, debit kwenye 5xxx/6xxx/7xxx)"
q "select to_char(e.entry_date,'YYYY-MM'), count(distinct e.uid), sum(l.debit_amount)
   from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid join capital_expenditure c on c.uid=e.reference_uid
   where e.status='POSTED' and not coalesce(e.is_reversal,false) and l.debit_amount > 0 and l.account_code ~ '^[567]'
     and extract(year from e.entry_date) in (2026, 2027) group by 1 order by 1"
echo "--- f2) mwezi wa gharama != mwezi wa kitabu (zilisogezwa na kipindi kilichofungwa?)"
q "select to_char(c.transaction_date,'YYYY-MM'), to_char(e.entry_date,'YYYY-MM'), count(*), sum(e.total_debit), string_agg(distinct left(c.description,30), ' ; ')
   from journal_entry e join capital_expenditure c on c.uid=e.reference_uid
   where e.status='POSTED' and not coalesce(e.is_reversal,false) and to_char(c.transaction_date,'YYYY-MM') <> to_char(e.entry_date,'YYYY-MM') group by 1,2 order by 1,2"
echo "--- f3) watoto walioidhinishwa, tarehe imefika, BILA journal (wanasubiri job ya postDue)"
q "select count(*), coalesce(sum(c.amount),0) from capital_expenditure c where c.parent_capital_expenditure_uid is not null and not coalesce(c.is_deleted,false) and c.status='APPROVED' and c.transaction_date::date <= current_date
   and not exists (select 1 from journal_entry e where e.reference_uid=c.uid)"
echo "---79_SERVER_MWISHO---"
