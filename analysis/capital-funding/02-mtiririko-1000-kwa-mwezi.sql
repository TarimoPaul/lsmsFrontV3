-- Mwendo wa 1000 kwa mwezi na aina ya tukio (Jun–13/10)
select date_trunc('month',e.entry_date)::date m, e.reference_type, round(sum(l.debit_amount)) dr, round(sum(l.credit_amount)) cr
from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid
where not e.is_deleted and l.account_code='1000' and e.entry_date between '2026-06-01' and '2026-10-13' group by 1,2 order by 1,2;
