with s as (select e.entry_date d, sum(l.debit_amount) cash_sales from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid
           where not e.is_deleted and l.account_code='1000' and e.reference_type in ('SALE_CASH','SALE_MIXED') and e.entry_date between '2026-06-01' and '2026-10-13' group by 1),
r as (select reconciliation_date d, count(*) n, sum(auto_cash_sales) reco_cash, sum(cash_on_hand_declared) declared, sum(purchases_total) rp, sum(expenses_total) rx
      from daily_reconciliation where not is_deleted and status<>'DRAFT' group by 1),
c as (select dr.reconciliation_date d, sum(c.amount) entries from reconciliation_cash_entries c join daily_reconciliation dr on dr.uid=c.reconciliation_uid
      where not c.is_deleted and not dr.is_deleted and dr.status<>'DRAFT' and c.entry_type in ('BANK_DEPOSIT','SAFE_BOX','CASH_IN_HAND','PETTY_CASH','CASH_PREVIOUS') group by 1)
select date_trunc('month',s.d)::date m, count(*) siku_mauzo, count(r.d) siku_reco,
 round(sum(s.cash_sales)) gl_cash_sales, round(sum(s.cash_sales) filter (where r.d is null)) mauzo_bila_reco,
 round(sum(r.reco_cash)) reco_cash, round(sum(c.entries)) entries_pesa, round(sum(r.rp)) reco_purch, round(sum(r.rx)) reco_exp
from s left join r using(d) left join c using(d) group by 1 order by 1;
