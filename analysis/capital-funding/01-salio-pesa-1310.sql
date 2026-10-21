-- lsms_audit (dump 14/10), read-only. Salio la akaunti za pesa (10xx) tarehe 13/10.
select l.account_code, a.account_name, round(sum(l.debit_amount - l.credit_amount),2) salio, count(*) mistari
from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid
join gl_account a on a.account_code=l.account_code
where not e.is_deleted and e.entry_date <= '2026-10-13' and l.account_code like '10%'
group by 1,2 order by 1;
-- 1000 tarehe 30/09
select round(sum(l.debit_amount-l.credit_amount),2) salio_1000_3009 from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid
where not e.is_deleted and e.entry_date <= '2026-09-30' and l.account_code='1000';
